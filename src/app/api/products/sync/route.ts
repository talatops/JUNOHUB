import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { isVendorPortalRole } from "@/lib/auth-roles"
import { prisma } from "@/lib/prisma"
import { supplierQuantityFromSyncedProductData } from "@/lib/products/shopifyInventorySum"
import { productSyncRequestSchema } from "@/lib/api-schemas/business"
import { validationErrorResponse } from "@/lib/api-schemas/validate"

/**
 * GET /api/products/sync
 * Get product sync status for vendor's products
 */
export async function GET() {
    try {
        const session = await auth()

        if (!session?.user?.id || !isVendorPortalRole(session.user.role)) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        // Get vendor's active store
        const vendorStore = await prisma.store.findFirst({
            where: {
                userId: session.user.id,
                isActive: true
            }
        })

        if (!vendorStore) {
            return NextResponse.json({ syncs: [] })
        }

        // Get all product syncs for this store
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const syncs = await (prisma as any).productSync.findMany({
            where: {
                storeId: vendorStore.id
            },
            include: {
                supplier: {
                    select: {
                        id: true,
                        companyName: true
                    }
                }
            },
            orderBy: {
                createdAt: "desc"
            }
        })

        const enriched = syncs.map((sync: any) => {
            const productData = sync.shopifyProductData || {}
            let supplierAvailable: number | null = null
            if (sync.status === "ACCEPTED") {
                const sq = supplierQuantityFromSyncedProductData(productData)
                if (sq !== undefined) supplierAvailable = sq
            }
            return {
                ...sync,
                supplierAvailableQuantity: supplierAvailable,
            }
        })

        return NextResponse.json({ syncs: enriched })
    } catch (error) {
        console.error("Error fetching product syncs:", error)
        return NextResponse.json(
            { message: "Failed to fetch product syncs" },
            { status: 500 }
        )
    }
}

/**
 * POST /api/products/sync
 * Create a product sync request
 */
export async function POST(req: Request) {
    try {
        const session = await auth()

        if (!session?.user?.id || !isVendorPortalRole(session.user.role)) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        const raw = await req.json().catch(() => ({}))
        const parsed = productSyncRequestSchema.safeParse(raw)
        if (!parsed.success) {
            return validationErrorResponse(parsed.error)
        }
        const { shopifyProductId, shopifyProductTitle, shopifyProductData, supplierId } = parsed.data

        // Get vendor's active store
        const vendorStore = await prisma.store.findFirst({
            where: {
                userId: session.user.id,
                isActive: true
            }
        })

        if (!vendorStore) {
            return NextResponse.json(
                { message: "No active store found" },
                { status: 400 }
            )
        }

        // Verify supplier exists
        const supplier = await prisma.supplierProfile.findUnique({
            where: { id: supplierId },
            include: {
                user: {
                    select: {
                        id: true
                    }
                }
            }
        })

        if (!supplier) {
            return NextResponse.json(
                { message: "Supplier not found" },
                { status: 404 }
            )
        }

        // Check if connection exists between vendor and supplier
        const connection = await prisma.connection.findUnique({
            where: {
                storeId_supplierId: {
                    storeId: vendorStore.id,
                    supplierId: supplier.id
                }
            }
        })

        if (!connection || connection.status !== "CONNECTED") {
            return NextResponse.json(
                { message: "You must be connected with this supplier before syncing products" },
                { status: 400 }
            )
        }

        // Check if sync already exists
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const existingSync = await (prisma as any).productSync.findUnique({
            where: {
                storeId_supplierId_shopifyProductId: {
                    storeId: vendorStore.id,
                    supplierId: supplier.id,
                    shopifyProductId
                }
            }
        })

        if (existingSync) {
            if (existingSync.status === "ACCEPTED") {
                return NextResponse.json(
                    { message: "This product is already synced with this supplier" },
                    { status: 400 }
                )
            }
            if (existingSync.status === "PENDING") {
                return NextResponse.json(
                    { message: "A sync request for this product is already pending" },
                    { status: 400 }
                )
            }
            // REJECTED: reuse row (unique on store+supplier+shopifyProductId) instead of create
            if (existingSync.status === "REJECTED") {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const productSync = await (prisma as any).productSync.update({
                    where: { id: existingSync.id },
                    data: {
                        shopifyProductTitle,
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        shopifyProductData: shopifyProductData
                            ? (shopifyProductData as any)
                            : undefined,
                        status: "PENDING",
                        requestedBy: session.user.id,
                        rejectedAt: null,
                        acceptedAt: null,
                    },
                })

                try {
                    const { notifyProductSyncRequested } = await import("@/lib/notifications")
                    await notifyProductSyncRequested(
                        supplier.user.id,
                        vendorStore.businessName,
                        shopifyProductTitle,
                        productSync.id
                    )
                } catch (notifError) {
                    console.error("Error creating notification:", notifError)
                }

                return NextResponse.json({
                    message: "Product sync request sent successfully",
                    sync: productSync,
                })
            }
        }

        // Create sync request
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const productSync = await (prisma as any).productSync.create({
            data: {
                storeId: vendorStore.id,
                supplierId: supplier.id,
                shopifyProductId,
                shopifyProductTitle,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                shopifyProductData: shopifyProductData ? (shopifyProductData as any) : undefined,
                status: "PENDING",
                requestedBy: session.user.id
            }
        })

        // Create notification for supplier
        try {
            const { notifyProductSyncRequested } = await import("@/lib/notifications")
            await notifyProductSyncRequested(
                supplier.user.id,
                vendorStore.businessName,
                shopifyProductTitle,
                productSync.id
            )
        } catch (notifError) {
            console.error("Error creating notification:", notifError)
            // Don't fail the request if notification fails
        }

        return NextResponse.json({
            message: "Product sync request sent successfully",
            sync: productSync
        })
    } catch (error) {
        console.error("Error creating product sync:", error)
        return NextResponse.json(
            { message: "Failed to create product sync request" },
            { status: 500 }
        )
    }
}
