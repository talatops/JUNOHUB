import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { normalizeFulfillmentStatus, toVendorDisplayStatus } from "@/lib/orders/fulfillmentStatus"
import {
    SUPPLIER_HOLD_REASON_LABELS,
    isSupplierHoldReasonCode,
} from "@/lib/orders/supplierHoldReasons"

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
        const acceptedSyncs = await prisma.productSync.findMany({
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

        type AcceptedSyncRow = (typeof acceptedSyncs)[number]

        // Group syncs by storeId
        const syncsByStore = new Map<string, Set<string>>()
        acceptedSyncs.forEach((sync: AcceptedSyncRow) => {
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

        type ShopifyLineItem = { product_id?: number }
        type CachedOrderWithStore = (typeof cachedOrders)[number]

        // Filter orders that contain synced products
        const relevantOrders = cachedOrders.filter((order: CachedOrderWithStore) => {
            const syncedProductIds = syncsByStore.get(order.storeId)
            if (!syncedProductIds || syncedProductIds.size === 0) return false

            // Parse line items from JSON
            try {
                const lineItems = typeof order.lineItems === "string" 
                    ? JSON.parse(order.lineItems) 
                    : order.lineItems

                if (!Array.isArray(lineItems)) return false

                // Check if any line item's product_id matches a synced product
                return lineItems.some((item: ShopifyLineItem) => {
                    const productId = item.product_id?.toString()
                    return productId && syncedProductIds.has(productId)
                })
            } catch {
                return false
            }
        })

            // Transform orders to include supplier-relevant information
            const transformedOrders = relevantOrders.map((order: CachedOrderWithStore) => {
                const syncedProductIds = syncsByStore.get(order.storeId) || new Set()
                let lineItems: ShopifyLineItem[] = []
            
            try {
                const parsed =
                    typeof order.lineItems === "string" ? JSON.parse(order.lineItems) : order.lineItems
                lineItems = Array.isArray(parsed) ? (parsed as ShopifyLineItem[]) : []
            } catch {
                lineItems = []
            }

            // Filter line items to only show synced products
            const syncedLineItems = lineItems.filter((item: ShopifyLineItem) => {
                const productId = item.product_id?.toString()
                return productId && syncedProductIds.has(productId)
            })

            return {
                id: order.shopifyOrderId,
                orderNumber: order.orderNumber,
                email: order.email,
                totalPrice: order.totalPrice,
                total: Number.parseFloat(order.totalPrice || "0"),
                currency: order.currency,
                financialStatus: order.financialStatus,
                fulfillmentStatus: normalizeFulfillmentStatus(order.fulfillmentStatus),
                status: normalizeFulfillmentStatus(order.fulfillmentStatus),
                fulfillmentStatusDisplay: toVendorDisplayStatus(order.fulfillmentStatus),
                trackingNumber: order.trackingNumber,
                trackingCompany: order.trackingCompany,
                trackingUrl: order.trackingUrl,
                pendingVendorSync: order.pendingVendorSync,
                holdReasonCode: order.holdReasonCode,
                holdNote: order.holdNote,
                holdReasonLabel:
                    order.holdReasonCode && isSupplierHoldReasonCode(order.holdReasonCode)
                        ? SUPPLIER_HOLD_REASON_LABELS[order.holdReasonCode]
                        : null,
                vendorName: order.store.businessName || order.store.shopifyStoreName,
                createdAt: order.shopifyCreatedAt || order.createdAt,
                store: order.store,
                lineItems: syncedLineItems,
                // Include all line items for reference, but mark synced ones
                allLineItems: lineItems.map((item: ShopifyLineItem) => ({
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
