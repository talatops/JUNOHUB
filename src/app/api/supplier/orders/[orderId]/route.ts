import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { normalizeFulfillmentStatus, toVendorDisplayStatus } from "@/lib/orders/fulfillmentStatus"
import {
    SUPPLIER_HOLD_REASON_LABELS,
    isSupplierHoldReasonCode,
} from "@/lib/orders/supplierHoldReasons"
import { supplierOrderPatchSchema, validationErrorResponse } from "@/lib/api-schemas"
import { runSupplierOrderShopifySync } from "@/lib/shopify/supplierOrderShopifySync"

async function getSupplierContext(userId: string) {
    const profile = await prisma.supplierProfile.findUnique({
        where: { userId },
        select: { id: true },
    })
    if (!profile) return null

    const acceptedSyncs = await prisma.productSync.findMany({
        where: { supplierId: profile.id, status: "ACCEPTED" },
        select: { storeId: true, shopifyProductId: true },
    })

    const syncsByStore = new Map<string, Set<string>>()
    for (const sync of acceptedSyncs) {
        if (!syncsByStore.has(sync.storeId)) syncsByStore.set(sync.storeId, new Set())
        syncsByStore.get(sync.storeId)!.add(sync.shopifyProductId)
    }

    return { profile, syncsByStore }
}

function extractLineItems(lineItems: unknown): Array<{ product_id?: number }> {
    try {
        const parsed = typeof lineItems === "string" ? JSON.parse(lineItems) : lineItems
        return Array.isArray(parsed) ? (parsed as Array<{ product_id?: number }>) : []
    } catch {
        return []
    }
}

function toObject(value: unknown): Record<string, unknown> | null {
    return value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null
}

function isSupplierAllowedForOrder(
    syncsByStore: Map<string, Set<string>>,
    storeId: string,
    lineItems: unknown,
) {
    const syncedProductIds = syncsByStore.get(storeId)
    if (!syncedProductIds || syncedProductIds.size === 0) return false
    const items = extractLineItems(lineItems)
    return items.some((item) => {
        const pid = item.product_id?.toString()
        return !!pid && syncedProductIds.has(pid)
    })
}

export async function GET(
    _req: Request,
    { params }: { params: Promise<{ orderId: string }> },
) {
    try {
        const session = await auth()
        if (!session?.user?.id || session.user.role !== "SUPPLIER") {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        const { orderId } = await params
        const ctx = await getSupplierContext(session.user.id)
        if (!ctx) {
            return NextResponse.json({ message: "Supplier profile not found" }, { status: 404 })
        }

        const order = await prisma.cachedOrder.findFirst({
            where: { shopifyOrderId: orderId },
            include: {
                store: {
                    select: { id: true, businessName: true, shopifyStoreName: true },
                },
            },
        })

        if (!order) {
            return NextResponse.json({ message: "Order not found" }, { status: 404 })
        }

        if (!isSupplierAllowedForOrder(ctx.syncsByStore, order.storeId, order.lineItems)) {
            return NextResponse.json({ message: "Order not accessible" }, { status: 403 })
        }

        let liveOrder: Record<string, unknown> | null = null
        try {
            const storeCredentials = await prisma.store.findUnique({
                where: { id: order.storeId },
                select: { shopifyDomain: true, shopifyAccessToken: true },
            })
            if (storeCredentials?.shopifyDomain && storeCredentials?.shopifyAccessToken) {
                const cleanDomain = storeCredentials.shopifyDomain
                    .trim()
                    .replace(/^https?:\/\//, "")
                    .replace(/\/$/, "")

                const response = await fetch(
                    `https://${cleanDomain}/admin/api/2024-01/orders/${orderId}.json`,
                    {
                        method: "GET",
                        headers: {
                            "X-Shopify-Access-Token": storeCredentials.shopifyAccessToken,
                            "Content-Type": "application/json",
                        },
                    },
                )
                if (response.ok) {
                    const payload = (await response.json()) as { order?: Record<string, unknown> }
                    liveOrder = toObject(payload.order)
                }
            }
        } catch (e) {
            console.error("[SUPPLIER_ORDER_GET_SHOPIFY]", e)
        }

        const cachedCustomer = toObject(order.customer)
        const customer = toObject(liveOrder?.customer) || cachedCustomer
        const shippingAddress = toObject(liveOrder?.shipping_address)
        const billingAddress = toObject(liveOrder?.billing_address)
        const lineItems = Array.isArray(liveOrder?.line_items)
            ? (liveOrder?.line_items as Array<{ product_id?: number }>)
            : extractLineItems(order.lineItems)

        return NextResponse.json({
            order: {
                id: order.shopifyOrderId,
                orderNumber: order.orderNumber,
                email: (typeof liveOrder?.email === "string" && liveOrder.email) || order.email,
                totalPrice: order.totalPrice,
                currency: order.currency,
                financialStatus: order.financialStatus,
                fulfillmentStatus: normalizeFulfillmentStatus(order.fulfillmentStatus),
                fulfillmentStatusDisplay: toVendorDisplayStatus(order.fulfillmentStatus),
                trackingNumber: order.trackingNumber,
                trackingCompany: order.trackingCompany,
                trackingUrl: order.trackingUrl,
                holdReasonCode: order.holdReasonCode,
                holdNote: order.holdNote,
                holdReasonLabel:
                    order.holdReasonCode && isSupplierHoldReasonCode(order.holdReasonCode)
                        ? SUPPLIER_HOLD_REASON_LABELS[order.holdReasonCode]
                        : null,
                createdAt: order.shopifyCreatedAt || order.createdAt,
                lineItems,
                customer,
                shippingAddress,
                billingAddress,
                store: order.store,
            },
        })
    } catch (error) {
        console.error("[SUPPLIER_ORDER_GET]", error)
        return NextResponse.json({ message: "Failed to fetch order" }, { status: 500 })
    }
}

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ orderId: string }> },
) {
    try {
        const session = await auth()
        if (!session?.user?.id || session.user.role !== "SUPPLIER") {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }
        const { orderId } = await params
        const raw = await req.json().catch(() => ({}))
        const parsed = supplierOrderPatchSchema.safeParse(raw)
        if (!parsed.success) {
            return validationErrorResponse(parsed.error)
        }
        const {
            fulfillmentStatus: fs,
            trackingNumber: trIn,
            trackingCompany: tcIn,
            trackingUrl: tuIn,
            holdReasonCode: hrIn,
            holdNote: hnIn,
        } = parsed.data

        const fulfillmentStatus = normalizeFulfillmentStatus(
            fs === undefined || fs === null ? undefined : String(fs),
        )

        const ctx = await getSupplierContext(session.user.id)
        if (!ctx) {
            return NextResponse.json({ message: "Supplier profile not found" }, { status: 404 })
        }

        const order = await prisma.cachedOrder.findFirst({
            where: { shopifyOrderId: orderId },
            select: {
                id: true,
                storeId: true,
                lineItems: true,
                fulfillmentStatus: true,
            },
        })
        if (!order) return NextResponse.json({ message: "Order not found" }, { status: 404 })
        if (!isSupplierAllowedForOrder(ctx.syncsByStore, order.storeId, order.lineItems)) {
            return NextResponse.json({ message: "Order not accessible" }, { status: 403 })
        }

        const previousCanonical = normalizeFulfillmentStatus(order.fulfillmentStatus)

        let trackingNumber = trIn
        let trackingCompany = tcIn
        let trackingUrl = tuIn
        let holdReasonCode: string | null = hrIn ?? null
        let holdNote: string | null = hnIn ?? null

        if (fulfillmentStatus === "ON_HOLD") {
            trackingNumber = null
            trackingCompany = null
            trackingUrl = null
        } else {
            holdReasonCode = null
            holdNote = null
        }

        const updated = await prisma.cachedOrder.update({
            where: { id: order.id },
            data: {
                fulfillmentStatus,
                holdReasonCode,
                holdNote,
                trackingNumber,
                trackingCompany,
                trackingUrl,
                pendingVendorSync: true,
                lastSupplierUpdateAt: new Date(),
                lastSupplierUpdatedBy: session.user.id,
                lastShopifySyncError: null,
            },
            select: {
                shopifyOrderId: true,
                fulfillmentStatus: true,
                holdReasonCode: true,
                holdNote: true,
            },
        })

        const shopifySync = await runSupplierOrderShopifySync({
            storeId: order.storeId,
            shopifyOrderId: orderId,
            previousCanonical,
            newCanonical: fulfillmentStatus,
            trackingNumber,
            trackingCompany,
            trackingUrl,
            holdCode:
                fulfillmentStatus === "ON_HOLD" && holdReasonCode && isSupplierHoldReasonCode(holdReasonCode)
                    ? holdReasonCode
                    : null,
            holdNote,
        })

        if (shopifySync.ok) {
            await prisma.cachedOrder.update({
                where: { id: order.id },
                data: {
                    pendingVendorSync: false,
                    lastShopifySyncAt: new Date(),
                    lastShopifySyncError: null,
                },
            })
        } else {
            await prisma.cachedOrder.update({
                where: { id: order.id },
                data: {
                    pendingVendorSync: true,
                    lastShopifySyncError: shopifySync.error || "Unknown sync error",
                },
            })
        }

        return NextResponse.json({
            order: {
                ...updated,
                trackingNumber,
                trackingCompany,
                trackingUrl,
                holdReasonLabel:
                    holdReasonCode && isSupplierHoldReasonCode(holdReasonCode)
                        ? SUPPLIER_HOLD_REASON_LABELS[holdReasonCode]
                        : null,
                pendingVendorSync: !shopifySync.ok,
                lastShopifySyncError: shopifySync.ok ? null : shopifySync.error || "Unknown sync error",
                fulfillmentStatusDisplay: toVendorDisplayStatus(updated.fulfillmentStatus),
            },
        })
    } catch (error) {
        console.error("[SUPPLIER_ORDER_PATCH]", error)
        return NextResponse.json({ message: "Failed to update order" }, { status: 500 })
    }
}

