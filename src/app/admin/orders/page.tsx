import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { ShoppingCart } from "lucide-react"

interface AdminOrder {
    id: string
    orderNumber: string
    email: string | null
    totalPrice: string
    currency: string | null
    financialStatus: string | null
    fulfillmentStatus: string | null
    createdAt: Date
    store: {
        businessName: string
        shopifyStoreName: string
    }
}

async function getOrders(): Promise<AdminOrder[]> {
    const acceptedSyncs = await prisma.productSync.findMany({
        where: { status: "ACCEPTED" },
        select: { shopifyProductId: true, storeId: true },
    })
    if (acceptedSyncs.length === 0) return []

    type AcceptedSyncPick = (typeof acceptedSyncs)[number]
    const syncsByStore = new Map<string, Set<string>>()
    acceptedSyncs.forEach((sync: AcceptedSyncPick) => {
        if (!syncsByStore.has(sync.storeId)) syncsByStore.set(sync.storeId, new Set())
        syncsByStore.get(sync.storeId)!.add(sync.shopifyProductId)
    })
    const storeIds = Array.from(syncsByStore.keys())

    const cachedOrders = await prisma.cachedOrder.findMany({
        where: { storeId: { in: storeIds } },
        include: {
            store: { select: { id: true, businessName: true, shopifyStoreName: true } },
        },
        orderBy: { shopifyCreatedAt: "desc" },
    })

    type CachedOrderRow = (typeof cachedOrders)[number]

    const relevantOrders = cachedOrders.filter((order: CachedOrderRow) => {
        const syncedProductIds = syncsByStore.get(order.storeId)
        if (!syncedProductIds?.size) return false
        try {
            const lineItems =
                typeof order.lineItems === "string" ? JSON.parse(order.lineItems) : order.lineItems
            if (!Array.isArray(lineItems)) return false
            return lineItems.some(
                (item: { product_id?: number }) =>
                    item.product_id != null && syncedProductIds.has(String(item.product_id))
            )
        } catch {
            return false
        }
    })

    return relevantOrders.map((order: CachedOrderRow) => {
        const store = order.store as { id: string; businessName: string; shopifyStoreName: string }
        return {
            id: order.shopifyOrderId,
            orderNumber: order.orderNumber,
            email: order.email,
            totalPrice: order.totalPrice,
            currency: order.currency,
            financialStatus: order.financialStatus,
            fulfillmentStatus: order.fulfillmentStatus,
            createdAt: order.shopifyCreatedAt || order.createdAt,
            store: { businessName: store.businessName, shopifyStoreName: store.shopifyStoreName },
        }
    }) as AdminOrder[]
}

export default async function AdminOrdersPage() {
    const session = await auth()
    if (!session || session.user.role !== "ADMIN") {
        redirect("/login")
    }

    const orders = await getOrders()

    return (
        <div className="flex flex-col gap-6 h-full">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
                        Orders with Synced Products
                    </h1>
                    <p className="text-sm text-slate-400 mt-1 max-w-2xl">
                        Orders from vendor stores that contain products synced with suppliers.
                    </p>
                </div>
            </div>

            <div className="flex-1 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-5 overflow-auto">
                <table className="min-w-full text-sm text-left">
                    <thead className="border-b border-white/10 text-xs uppercase tracking-wide text-slate-400">
                        <tr>
                            <th className="py-2 pr-4 font-semibold">Order</th>
                            <th className="py-2 pr-4 font-semibold">Vendor Store</th>
                            <th className="py-2 pr-4 font-semibold">Customer</th>
                            <th className="py-2 pr-4 font-semibold">Total</th>
                            <th className="py-2 pr-4 font-semibold">Financial</th>
                            <th className="py-2 pr-4 font-semibold">Fulfillment</th>
                            <th className="py-2 pr-4 font-semibold">Created</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {orders.length === 0 && (
                            <tr>
                                <td
                                    colSpan={7}
                                    className="py-6 text-center text-sm text-slate-500"
                                >
                                    No orders with synced products found.
                                </td>
                            </tr>
                        )}
                        {orders.map((order) => (
                            <tr key={order.id} className="hover:bg-white/5">
                                <td className="py-3 pr-4 align-top">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-400/30 flex items-center justify-center">
                                            <ShoppingCart className="w-4 h-4 text-blue-200" />
                                        </div>
                                        <div>
                                            <div className="text-xs font-semibold text-white">
                                                #{order.orderNumber}
                                            </div>
                                            <div className="text-[11px] text-slate-400">
                                                Order ID: {order.id}
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                <td className="py-3 pr-4 align-top">
                                    <div className="text-xs font-semibold text-white">
                                        {order.store.businessName}
                                    </div>
                                    <div className="text-[11px] text-slate-400">
                                        {order.store.shopifyStoreName}
                                    </div>
                                </td>
                                <td className="py-3 pr-4 align-top text-xs text-slate-300">
                                    {order.email || "—"}
                                </td>
                                <td className="py-3 pr-4 align-top text-xs text-slate-200">
                                    {order.totalPrice} {order.currency || ""}
                                </td>
                                <td className="py-3 pr-4 align-top text-[11px] text-slate-300">
                                    {order.financialStatus || "—"}
                                </td>
                                <td className="py-3 pr-4 align-top text-[11px] text-slate-300">
                                    {order.fulfillmentStatus || "—"}
                                </td>
                                <td className="py-3 pr-4 align-top text-xs text-slate-400">
                                    {new Date(order.createdAt as Date).toLocaleString("en-US", {
                                        dateStyle: "short",
                                        timeStyle: "short",
                                    })}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

