import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { auth } from "@/auth"
import { isVendorPortalRole } from "@/lib/auth-roles"
import { loadStockRequestSchema } from "@/lib/api-schemas/business"
import { validationErrorResponse } from "@/lib/api-schemas/validate"
import { prisma } from "@/lib/prisma"
import { mergeShopifyProductDataAfterLoadStock } from "@/lib/products/applyLoadStockSupplierQuantity"
import { supplierQuantityFromSyncedProductData } from "@/lib/products/shopifyInventorySum"
import {
    adjustAvailableInventory,
    getFirstVariantInventoryItemId,
    resolveLocationIdForInventoryAdjust,
} from "@/lib/shopify/inventoryAdjust"

class LoadStockHttpError extends Error {
    constructor(
        public status: number,
        message: string
    ) {
        super(message)
        this.name = "LoadStockHttpError"
    }
}

/**
 * POST /api/shopify/inventory/load-stock
 * Vendor: increase Shopify sellable inventory for the first variant and decrement supplier stock on ProductSync.
 */
export async function POST(req: Request) {
    try {
        const session = await auth()
        if (!session?.user?.id || !isVendorPortalRole(session.user.role)) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        const raw = await req.json().catch(() => ({}))
        const parsed = loadStockRequestSchema.safeParse(raw)
        if (!parsed.success) {
            return validationErrorResponse(parsed.error)
        }
        const { productSyncId, quantity } = parsed.data

        const vendorStore = await prisma.store.findFirst({
            where: { userId: session.user.id, isActive: true },
            select: {
                id: true,
                shopifyDomain: true,
                shopifyAccessToken: true,
            },
        })

        if (!vendorStore?.shopifyAccessToken || !vendorStore.shopifyDomain) {
            return NextResponse.json({ message: "Shopify store not connected." }, { status: 400 })
        }

        const { shopifyAccessToken: token, shopifyDomain } = vendorStore

        let shopifyAdjusted = false
        let newSupplierQty: number | undefined
        let compensate:
            | {
                  inventoryItemId: number
                  locationId: number
              }
            | undefined

        try {
            await prisma.$transaction(async (tx) => {
                await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(abs(hashtext(${productSyncId}))::bigint)`)

                const sync = await tx.productSync.findUnique({
                    where: { id: productSyncId },
                })

                if (!sync) {
                    throw new LoadStockHttpError(404, "Product sync not found.")
                }
                if (sync.storeId !== vendorStore.id) {
                    throw new LoadStockHttpError(403, "You cannot load stock for this product.")
                }
                if (sync.status !== "ACCEPTED") {
                    throw new LoadStockHttpError(400, "Product sync must be accepted before loading stock.")
                }

                const available = supplierQuantityFromSyncedProductData(sync.shopifyProductData)
                if (available === undefined) {
                    throw new LoadStockHttpError(
                        400,
                        "Supplier stock is unknown for this product. Ask the supplier to set quantity or refresh the sync."
                    )
                }
                if (quantity > available) {
                    throw new LoadStockHttpError(
                        400,
                        `Amount cannot exceed supplier stock (${available}).`
                    )
                }

                const item = await getFirstVariantInventoryItemId(shopifyDomain, token, sync.shopifyProductId)
                if ("error" in item) {
                    throw new LoadStockHttpError(400, item.error)
                }

                const loc = await resolveLocationIdForInventoryAdjust(shopifyDomain, token, item.inventoryItemId)
                if ("error" in loc) {
                    throw new LoadStockHttpError(loc.status ?? 502, loc.error)
                }

                const adjust = await adjustAvailableInventory(shopifyDomain, token, {
                    inventoryItemId: item.inventoryItemId,
                    locationId: loc.locationId,
                    availableAdjustment: quantity,
                })
                if ("error" in adjust) {
                    throw new LoadStockHttpError(adjust.status, adjust.error)
                }

                shopifyAdjusted = true
                compensate = {
                    inventoryItemId: item.inventoryItemId,
                    locationId: loc.locationId,
                }

                const nextData = mergeShopifyProductDataAfterLoadStock(sync.shopifyProductData, quantity)
                newSupplierQty = supplierQuantityFromSyncedProductData(nextData as unknown)

                await tx.productSync.update({
                    where: { id: sync.id },
                    data: { shopifyProductData: nextData },
                })
            })
        } catch (inner: unknown) {
            if (shopifyAdjusted && compensate) {
                await adjustAvailableInventory(shopifyDomain, token, {
                    inventoryItemId: compensate.inventoryItemId,
                    locationId: compensate.locationId,
                    availableAdjustment: -quantity,
                }).catch((e) => {
                    console.error("[load-stock] Failed to compensate Shopify after DB error:", e)
                })
            }
            if (inner instanceof LoadStockHttpError) {
                return NextResponse.json({ message: inner.message }, { status: inner.status })
            }
            throw inner
        }

        return NextResponse.json({
            message: "Stock loaded successfully.",
            quantity,
            newSupplierQty: newSupplierQty ?? null,
        })
    } catch (error) {
        console.error("[load-stock]", error)
        return NextResponse.json({ message: "Failed to load stock." }, { status: 500 })
    }
}
