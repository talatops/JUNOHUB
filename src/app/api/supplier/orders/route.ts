import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

/**
 * GET /api/supplier/orders
 * List orders from connected vendors that contain synced products
 */
export async function GET() {
    try {
        const session = await auth()

        if (!session?.user?.id || session.user.role !== "SUPPLIER") {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        // Get supplier profile
        const supplierProfile = await prisma.supplierProfile.findUnique({
            where: { userId: session.user.id }
        })

        if (!supplierProfile) {
            return NextResponse.json({ message: "Supplier profile not found" }, { status: 404 })
        }

        // Get connected vendors
        const connections = await prisma.connection.findMany({
            where: {
                supplierId: supplierProfile.id,
                status: "CONNECTED"
            },
            include: {
                store: {
                    select: {
                        id: true,
                        businessName: true,
                        shopifyStoreName: true
                    }
                }
            }
        })

        if (connections.length === 0) {
            return NextResponse.json({
                orders: [],
                connectedVendors: 0,
                syncedProducts: 0
            })
        }

        // Get all accepted product syncs for this supplier
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const acceptedSyncs = await (prisma as any).productSync.findMany({
            where: {
                supplierId: supplierProfile.id,
                status: "ACCEPTED"
            },
            select: {
                shopifyProductId: true,
                storeId: true,
                shopifyProductTitle: true
            }
        })

        if (acceptedSyncs.length === 0) {
            return NextResponse.json({
                orders: [],
                connectedVendors: connections.length,
                syncedProducts: 0,
                message: "No products synced yet. Sync products with vendors to see orders."
            })
        }

        // Group syncs by storeId
        const syncsByStore = new Map<string, Set<string>>()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        acceptedSyncs.forEach((sync: any) => {
            if (!syncsByStore.has(sync.storeId)) {
                syncsByStore.set(sync.storeId, new Set())
            }
            syncsByStore.get(sync.storeId)!.add(sync.shopifyProductId)
        })

        // Get orders from all connected stores that have synced products
        const storeIds = Array.from(syncsByStore.keys())
        const cachedOrders = await prisma.cachedOrder.findMany({
            where: {
                storeId: { in: storeIds }
            },
            include: {
                store: {
                    select: {
                        id: true,
                        businessName: true,
                        shopifyStoreName: true
                    }
                }
            },
            orderBy: {
                shopifyCreatedAt: "desc"
            }
        })

        // Filter orders that contain synced products
        const relevantOrders = cachedOrders.filter((order) => {
            const syncedProductIds = syncsByStore.get(order.storeId)
            if (!syncedProductIds || syncedProductIds.size === 0) return false

            // Parse line items from JSON
            try {
                const lineItems = typeof order.lineItems === "string" 
                    ? JSON.parse(order.lineItems) 
                    : order.lineItems

                if (!Array.isArray(lineItems)) return false

                // Check if any line item's product_id matches a synced product
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                return lineItems.some((item: any) => {
                    const productId = item.product_id?.toString()
                    return productId && syncedProductIds.has(productId)
                })
            } catch {
                return false
            }
        })

            // Transform orders to include supplier-relevant information
            const transformedOrders = relevantOrders.map((order) => {
                const syncedProductIds = syncsByStore.get(order.storeId) || new Set()
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                let lineItems: any[] = []
            
            try {
                lineItems = typeof order.lineItems === "string" 
                    ? JSON.parse(order.lineItems) 
                    : order.lineItems
            } catch {
                lineItems = []
            }

            // Filter line items to only show synced products
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const syncedLineItems = lineItems.filter((item: any) => {
                const productId = item.product_id?.toString()
                return productId && syncedProductIds.has(productId)
            })

            return {
                id: order.shopifyOrderId,
                orderNumber: order.orderNumber,
                email: order.email,
                totalPrice: order.totalPrice,
                currency: order.currency,
                financialStatus: order.financialStatus,
                fulfillmentStatus: order.fulfillmentStatus,
                createdAt: order.shopifyCreatedAt || order.createdAt,
                store: order.store,
                lineItems: syncedLineItems,
                // Include all line items for reference, but mark synced ones
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                allLineItems: lineItems.map((item: any) => ({
                    ...item,
                    isSynced: syncedProductIds.has(item.product_id?.toString() || "")
                }))
            }
        })

        return NextResponse.json({
            orders: transformedOrders,
            connectedVendors: connections.length,
            syncedProducts: acceptedSyncs.length,
            totalOrders: transformedOrders.length
        })
    } catch (error) {
        console.error("Error fetching orders:", error)
        return NextResponse.json(
            { message: "Failed to fetch orders" },
            { status: 500 }
        )
    }
}
