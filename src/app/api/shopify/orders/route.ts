import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { isCacheFresh, getCachedOrders, updateOrderCache } from "@/lib/cache"
import { normalizeFulfillmentStatus, toVendorDisplayStatus } from "@/lib/orders/fulfillmentStatus"

export async function GET() {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        const store = await prisma.store.findFirst({
            where: { userId: session.user.id, isActive: true }
        })

        if (!store || !store.shopifyAccessToken || !store.shopifyDomain) {
            return NextResponse.json({ message: "Shopify store not connected." }, { status: 400 })
        }

        // Clean domain to remove any whitespace or invalid characters
        const cleanDomain = store.shopifyDomain.trim().replace(/^https?:\/\//, "").replace(/\/$/, "").trim()
        
        if (!cleanDomain) {
            return NextResponse.json({ message: "Invalid Shopify domain configured." }, { status: 400 })
        }

        // Check if cache is fresh
        const cacheFresh = await isCacheFresh(store.id, "orders")

        if (cacheFresh) {
            // Return cached data transformed to match Shopify format
            const cachedOrders = await getCachedOrders(store.id)
            type CachedOrderRow = (typeof cachedOrders)[number]
            const transformedOrders = cachedOrders.map((order: CachedOrderRow) => ({
                id: parseInt(order.shopifyOrderId),
                name: order.orderNumber,
                email: order.email,
                created_at: order.shopifyCreatedAt?.toISOString() || order.createdAt.toISOString(),
                total_price: order.totalPrice,
                currency: order.currency,
                financial_status: order.financialStatus,
                fulfillment_status: toVendorDisplayStatus(order.fulfillmentStatus),
                fulfillment_status_canonical: normalizeFulfillmentStatus(order.fulfillmentStatus),
                customer: order.customer,
                line_items: order.lineItems,
                tracking_number: order.trackingNumber || null,
                tracking_company: order.trackingCompany || null,
                tracking_url: order.trackingUrl || null,
                pending_vendor_sync: order.pendingVendorSync || false,
                last_supplier_update_at: order.lastSupplierUpdateAt?.toISOString() || null,
                last_shopify_sync_at: order.lastShopifySyncAt?.toISOString() || null,
                last_shopify_sync_error: order.lastShopifySyncError || null,
            }))
            return NextResponse.json({
                orders: transformedOrders,
                cached: true,
                count: transformedOrders.length
            })
        }

        // Fetch orders from Shopify with timeout and limit
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

        try {
            const response = await fetch(
                `https://${cleanDomain}/admin/api/2024-01/orders.json?status=any&limit=50`,
                {
                    method: "GET",
                    headers: {
                        "X-Shopify-Access-Token": store.shopifyAccessToken,
                        "Content-Type": "application/json"
                    },
                    signal: controller.signal
                }
            )
            clearTimeout(timeoutId)

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: "Unknown error" }))
                console.error("Shopify API error:", { status: response.status, error: errorData, storeId: store.id })
                return NextResponse.json({
                    message: "Failed to fetch orders from Shopify.",
                    details: errorData
                }, { status: response.status })
            }

            const data = await response.json()

            // Update cache in background
            if (data.orders) {
                await updateOrderCache(store.id, data.orders).catch(err => {
                    console.error("Cache update error:", err)
                })
            }

            const cachedOrders = await prisma.cachedOrder.findMany({
                where: { storeId: store.id },
                select: {
                    shopifyOrderId: true,
                    fulfillmentStatus: true,
                    trackingNumber: true,
                    trackingCompany: true,
                    trackingUrl: true,
                    pendingVendorSync: true,
                    lastSupplierUpdateAt: true,
                    lastShopifySyncAt: true,
                    lastShopifySyncError: true,
                },
            })
            const byId = new Map(cachedOrders.map((o) => [o.shopifyOrderId, o]))
            const mergedOrders = (data.orders || []).map((o: Record<string, unknown>) => {
                const local = byId.get(String(o.id))
                if (!local) return o
                return {
                    ...o,
                    fulfillment_status: toVendorDisplayStatus(local.fulfillmentStatus),
                    fulfillment_status_canonical: normalizeFulfillmentStatus(local.fulfillmentStatus),
                    tracking_number: local.trackingNumber || null,
                    tracking_company: local.trackingCompany || null,
                    tracking_url: local.trackingUrl || null,
                    pending_vendor_sync: local.pendingVendorSync || false,
                    last_supplier_update_at: local.lastSupplierUpdateAt?.toISOString() || null,
                    last_shopify_sync_at: local.lastShopifySyncAt?.toISOString() || null,
                    last_shopify_sync_error: local.lastShopifySyncError || null,
                }
            })

            return NextResponse.json({ ...data, orders: mergedOrders, cached: false })
        } catch (fetchError: unknown) {
            clearTimeout(timeoutId)
            if (fetchError instanceof Error && fetchError.name === "AbortError") {
                return NextResponse.json({
                    message: "Request timeout. Shopify API took too long to respond.",
                    error: "TIMEOUT"
                }, { status: 504 })
            }
            throw fetchError
        }

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error"
        console.error("Fetch orders error:", { message, error, stack: error instanceof Error ? error.stack : undefined })
        return NextResponse.json({
            message: "Internal server error while fetching orders.",
            error: message
        }, { status: 500 })
    }
}
