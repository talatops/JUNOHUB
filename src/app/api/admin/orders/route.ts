import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
    try {
        const session = await auth()

        if (!session?.user?.id || session.user.role !== "ADMIN") {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        // Get all accepted product syncs
        const acceptedSyncs = await prisma.productSync.findMany({
            where: {
                status: "ACCEPTED",
            },
            select: {
                shopifyProductId: true,
                storeId: true,
                shopifyProductTitle: true,
            },
        })

        if (acceptedSyncs.length === 0) {
            return NextResponse.json({
                orders: [],
                syncedProducts: 0,
                totalOrders: 0,
            })
        }

        const syncsByStore = new Map<string, Set<string>>()
        acceptedSyncs.forEach((sync: (typeof acceptedSyncs)[number]) => {
            if (!syncsByStore.has(sync.storeId)) {
                syncsByStore.set(sync.storeId, new Set())
            }
            syncsByStore.get(sync.storeId)!.add(sync.shopifyProductId)
        })

        const storeIds = Array.from(syncsByStore.keys())
        const cachedOrders = await prisma.cachedOrder.findMany({
            where: {
                storeId: { in: storeIds },
            },
            include: {
                store: {
                    select: {
                        id: true,
                        businessName: true,
                        shopifyStoreName: true,
                    },
                },
            },
            orderBy: {
                shopifyCreatedAt: "desc",
            },
        })

        const relevantOrders = cachedOrders.filter((order: typeof cachedOrders[0]) => {
            const syncedProductIds = syncsByStore.get(order.storeId)
            if (!syncedProductIds || syncedProductIds.size === 0) return false

            try {
                const lineItems =
                    typeof order.lineItems === "string"
                        ? JSON.parse(order.lineItems)
                        : order.lineItems

                if (!Array.isArray(lineItems)) return false

                return lineItems.some((item: { product_id?: number }) => {
                    const productId = item.product_id?.toString()
                    return productId && syncedProductIds.has(productId)
                })
            } catch {
                return false
            }
        })

        const transformedOrders = relevantOrders.map((order: typeof relevantOrders[0]) => {
            const syncedProductIds = syncsByStore.get(order.storeId) || new Set()
            let lineItems: { product_id?: number }[] = []

            try {
                lineItems =
                    typeof order.lineItems === "string"
                        ? JSON.parse(order.lineItems)
                        : order.lineItems
            } catch {
                lineItems = []
            }

            const syncedLineItems = lineItems.filter((item: { product_id?: number }) => {
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
            }
        })

        return NextResponse.json({
            orders: transformedOrders,
            syncedProducts: acceptedSyncs.length,
            totalOrders: transformedOrders.length,
        })
    } catch (error) {
        console.error("Error fetching admin orders:", error)
        return NextResponse.json(
            { message: "Failed to fetch orders" },
            { status: 500 },
        )
    }
}

