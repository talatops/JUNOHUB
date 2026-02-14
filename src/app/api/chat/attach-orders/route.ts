import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { getCachedOrders, isCacheFresh, updateOrderCache } from "@/lib/cache"

const PER_STORE_LIMIT = 25

/**
 * GET /api/chat/attach-orders
 * Returns orders from all vendor stores (for chat attach). Each item includes storeId and storeName.
 * Vendor-only.
 */
export async function GET() {
    try {
        const session = await auth()
        if (!session?.user?.id || session.user.role !== "VENDOR") {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        const stores = await prisma.store.findMany({
            where: { userId: session.user.id },
            select: {
                id: true,
                businessName: true,
                shopifyDomain: true,
                shopifyAccessToken: true
            }
        })

        if (stores.length === 0) {
            return NextResponse.json({ orders: [] })
        }

        type OrderItem = {
            id: number
            name: string
            total_price: string
            currency?: string
            storeId: string
            storeName: string
        }

        const fetchOrdersForStore = async (
            store: { id: string; businessName: string | null; shopifyDomain: string | null; shopifyAccessToken: string | null }
        ): Promise<OrderItem[]> => {
            const cleanDomain = (store.shopifyDomain || "").trim().replace(/^https?:\/\//, "").replace(/\/$/, "").trim()
            if (!cleanDomain || !store.shopifyAccessToken) return []
            const storeName = store.businessName || store.shopifyDomain || "Store"

            const cacheFresh = await isCacheFresh(store.id, "orders")
            if (cacheFresh) {
                const cached = await getCachedOrders(store.id)
                return cached.slice(0, PER_STORE_LIMIT).map((order) => ({
                    id: parseInt(order.shopifyOrderId),
                    name: order.orderNumber,
                    total_price: order.totalPrice,
                    currency: order.currency || undefined,
                    storeId: store.id,
                    storeName
                }))
            }

            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), 15000)
            try {
                const response = await fetch(
                    `https://${cleanDomain}/admin/api/2024-01/orders.json?status=any&limit=${PER_STORE_LIMIT}`,
                    {
                        method: "GET",
                        headers: {
                            "X-Shopify-Access-Token": store.shopifyAccessToken!,
                            "Content-Type": "application/json"
                        },
                        signal: controller.signal
                    }
                )
                clearTimeout(timeoutId)
                if (!response.ok) return []
                const data = await response.json()
                if (data.orders?.length) {
                    await updateOrderCache(store.id, data.orders).catch(() => {})
                }
                return (data.orders || []).map((o: { id: number; name?: string; total_price?: string; currency?: string }) => ({
                    id: o.id,
                    name: o.name || `#${o.id}`,
                    total_price: o.total_price || "0",
                    currency: o.currency,
                    storeId: store.id,
                    storeName
                }))
            } catch {
                return []
            }
        }

        const results = await Promise.allSettled(stores.map((s) => fetchOrdersForStore(s)))
        const allOrders: OrderItem[] = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []))
        allOrders.sort((a, b) => (b.id > a.id ? 1 : -1))
        return NextResponse.json({ orders: allOrders.slice(0, 50) })
    } catch (error) {
        console.error("Chat attach orders error:", error)
        return NextResponse.json({ message: "Failed to load orders", orders: [] }, { status: 500 })
    }
}
