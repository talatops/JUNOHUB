"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
    ShoppingCart,
    Search,
    Loader2,
    AlertCircle,
    Package,
    ChevronRight
} from "lucide-react"
import { useTheme } from "@/components/ThemeProvider"

export default function SupplierOrdersPage() {
    const router = useRouter()
    const { theme } = useTheme()
    const isLight = theme === "light"
    const [orders, setOrders] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState("")
    const [searchTerm, setSearchTerm] = useState("")
    const [connectedVendors, setConnectedVendors] = useState(0)

    useEffect(() => {
        fetchOrders()
    }, [])

    const fetchOrders = async () => {
        try {
            setLoading(true)
            const res = await fetch("/api/supplier/orders")
            if (!res.ok) throw new Error("Failed to fetch orders")
            const data = await res.json()
            setOrders(data.orders || [])
            setConnectedVendors(data.connectedVendors || 0)
            setError("")
        } catch {
            setError("Failed to load orders")
        } finally {
            setLoading(false)
        }
    }

    const filteredOrders = orders.filter((order) =>
        order.orderNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.vendorName?.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">Orders</h1>
                <p className="text-sm md:text-base text-slate-400 mt-1">View and manage orders from vendors</p>
            </div>

            {error && (
                <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-4 flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-red-400" />
                    <span className="text-sm text-red-400 font-medium">{error}</span>
                </div>
            )}

            {/* Info Card */}
            <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-6">
                <div className="flex items-start gap-4">
                    <div className="p-3 bg-indigo-500/20 rounded-lg">
                        <ShoppingCart className="w-6 h-6 text-indigo-400" />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-lg font-bold text-white mb-2">Order Management</h3>
                        <p className="text-sm text-slate-400 mb-4">
                            Track orders placed by your connected vendors. Orders will appear here once vendors place orders for your products.
                        </p>
                        <div className="flex items-center gap-4 text-sm">
                            <div className="flex items-center gap-2">
                                <Package className="w-4 h-4 text-slate-400" />
                                <span className="text-slate-300">Connected Vendors: <span className="font-bold text-white">{connectedVendors}</span></span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                    type="text"
                    placeholder="Search orders by order number or vendor..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full h-12 bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50"
                />
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
                </div>
            ) : filteredOrders.length === 0 ? (
                <div className="bg-white/5 rounded-xl p-12 border border-white/10 text-center">
                    <ShoppingCart className="w-12 h-12 text-slate-400 mx-auto mb-4 opacity-50" />
                    <p className="text-slate-400 font-medium mb-2">
                        {searchTerm ? "No orders found matching your search" : "No orders yet"}
                    </p>
                    <p className="text-sm text-slate-500">
                        Orders from your connected vendors will appear here once they place orders for your products.
                    </p>
                </div>
            ) : (
            <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-white/5 border-b border-white/10">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Order #</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Vendor</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Date</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Total</th>
                                    <th className="px-6 py-4 text-right text-xs font-bold text-slate-400 uppercase tracking-wider">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/10">
                                {filteredOrders.map((order) => (
                                    <tr
                                        key={order.id}
                                        className="hover:bg-white/5 transition-colors cursor-pointer"
                                        onClick={() => router.push(`/supplier/orders/${order.id}`)}
                                    >
                                        <td className="px-6 py-4 font-medium text-white">{order.orderNumber}</td>
                                        <td className="px-6 py-4 text-sm text-slate-300">{order.vendorName}</td>
                                        <td className="px-6 py-4 text-sm text-slate-300">
                                            {new Date(order.createdAt).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                                (order.status || "").toUpperCase() === "FULFILLED" ? "bg-emerald-500/20 text-emerald-400" :
                                                (order.status || "").toUpperCase() === "SHIPPED" || (order.status || "").toUpperCase() === "IN_PROGRESS" ? "bg-yellow-500/20 text-yellow-400" :
                                                (order.status || "").toUpperCase() === "ON_HOLD"
                                                    ? isLight
                                                        ? "bg-amber-100 text-amber-800 border border-amber-300"
                                                        : "bg-amber-500/20 text-amber-300"
                                                    :
                                                (order.status || "").toUpperCase() === "CANCELLED" ? "bg-red-500/20 text-red-400" :
                                                "bg-blue-500/20 text-blue-400"
                                            }`}>
                                                {(order.status || "").toUpperCase() === "ON_HOLD"
                                                    ? "On hold"
                                                    : order.status || "UNFULFILLED"}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm font-medium text-white">${Number(order.total || 0).toFixed(2)}</td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="inline-flex items-center gap-1 text-indigo-300 text-sm font-semibold">
                                                Manage <ChevronRight className="w-4 h-4" />
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    )
}
