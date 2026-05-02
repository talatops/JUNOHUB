"use client"

import { useEffect, useState } from "react"
import {
    Package,
    ShoppingCart,
    Users,
    TrendingUp,
    Loader2,
    ArrowUpRight,
    Clock,
    CheckCircle2,
    DollarSign,
    AlertCircle
} from "lucide-react"
import Link from "next/link"
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    Cell
} from "recharts"

export default function SupplierDashboardPage() {
    const [stats, setStats] = useState({
        totalProducts: 0,
        activeOrders: 0,
        connectedVendors: 0,
        totalRevenue: 0,
        pendingConnections: 0,
        recentProducts: 0,
        averageProductPrice: 0,
        recentConnections: 0
    })
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState("")

    useEffect(() => {
        fetchDashboardData()
    }, [])

    const fetchDashboardData = async () => {
        try {
            setLoading(true)
            const [profileRes, analyticsRes, ordersRes] = await Promise.all([
                fetch("/api/supplier/profile").catch(() => null),
                fetch("/api/supplier/analytics").catch(() => null),
                fetch("/api/supplier/orders").catch(() => null)
            ])

            const profileData = profileRes?.ok ? await profileRes.json().catch(() => ({})) : {}
            const analyticsData = analyticsRes?.ok ? await analyticsRes.json().catch(() => ({})) : {}
            const ordersData = ordersRes?.ok ? await ordersRes.json().catch(() => ({})) : {}

            setStats({
                totalProducts: analyticsData?.stats?.totalProducts || 0,
                activeOrders: ordersData?.orders?.length || 0,
                connectedVendors: analyticsData?.stats?.connectedVendors || 0,
                totalRevenue: 0,
                pendingConnections: analyticsData?.stats?.pendingConnections || 0,
                recentProducts: analyticsData?.stats?.recentProducts || 0,
                averageProductPrice: analyticsData?.stats?.averageProductPrice || 0,
                recentConnections: analyticsData?.stats?.recentConnections || 0
            })
            setError("")
        } catch {
            setError("Failed to load dashboard data")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">Supplier Dashboard</h1>
                <p className="text-sm md:text-base text-slate-400 mt-1">Welcome to your supplier portal</p>
            </div>

            {error && (
                <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-4 flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-red-400" />
                    <span className="text-sm text-red-400 font-medium">{error}</span>
                </div>
            )}

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
                </div>
            ) : (
                <>
                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-6 backdrop-blur-sm hover:scale-[1.02] transition-transform duration-200">
                            <div className="flex items-center justify-between mb-4">
                                <div className="p-3 rounded-lg bg-emerald-500/20">
                                    <Package className="w-6 h-6 text-emerald-400" />
                                </div>
                                <ArrowUpRight className="w-5 h-5 text-emerald-400 opacity-50" />
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-1">{stats.totalProducts}</h3>
                            <p className="text-sm text-slate-400">Total Products</p>
                        </div>

                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-6 backdrop-blur-sm hover:scale-[1.02] transition-transform duration-200">
                            <div className="flex items-center justify-between mb-4">
                                <div className="p-3 rounded-lg bg-blue-500/20">
                                    <ShoppingCart className="w-6 h-6 text-blue-400" />
                                </div>
                                <ArrowUpRight className="w-5 h-5 text-blue-400 opacity-50" />
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-1">{stats.activeOrders}</h3>
                            <p className="text-sm text-slate-400">Active Orders</p>
                        </div>

                        <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-6 backdrop-blur-sm hover:scale-[1.02] transition-transform duration-200">
                            <div className="flex items-center justify-between mb-4">
                                <div className="p-3 rounded-lg bg-purple-500/20">
                                    <Users className="w-6 h-6 text-purple-400" />
                                </div>
                                <ArrowUpRight className="w-5 h-5 text-purple-400 opacity-50" />
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-1">{stats.connectedVendors}</h3>
                            <p className="text-sm text-slate-400">Connected Vendors</p>
                        </div>

                        <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-6 backdrop-blur-sm hover:scale-[1.02] transition-transform duration-200">
                            <div className="flex items-center justify-between mb-4">
                                <div className="p-3 rounded-lg bg-orange-500/20">
                                    <TrendingUp className="w-6 h-6 text-orange-400" />
                                </div>
                                <ArrowUpRight className="w-5 h-5 text-orange-400 opacity-50" />
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-1">${stats.totalRevenue.toFixed(2)}</h3>
                            <p className="text-sm text-slate-400">Total Revenue</p>
                        </div>
                    </div>

                    {/* Additional Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-6 backdrop-blur-sm hover:scale-[1.02] transition-transform duration-200">
                            <div className="flex items-center justify-between mb-4">
                                <div className="p-3 rounded-lg bg-yellow-500/20">
                                    <Users className="w-6 h-6 text-yellow-400" />
                                </div>
                                <ArrowUpRight className="w-5 h-5 text-yellow-400 opacity-50" />
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-1">{stats.pendingConnections}</h3>
                            <p className="text-sm text-slate-400">Pending Connections</p>
                        </div>

                        <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-6 backdrop-blur-sm hover:scale-[1.02] transition-transform duration-200">
                            <div className="flex items-center justify-between mb-4">
                                <div className="p-3 rounded-lg bg-orange-500/20">
                                    <DollarSign className="w-6 h-6 text-orange-400" />
                                </div>
                                <ArrowUpRight className="w-5 h-5 text-orange-400 opacity-50" />
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-1">${stats.averageProductPrice.toFixed(2)}</h3>
                            <p className="text-sm text-slate-400">Avg. Product Price</p>
                        </div>
                    </div>

                    {/* Quick Actions & Recent Activity */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white/5 rounded-xl p-6 border border-white/10 backdrop-blur-sm">
                            <h3 className="text-lg font-bold text-white mb-2">Quick Actions</h3>
                            <p className="text-sm text-slate-400 mb-4">Common tasks and shortcuts</p>
                            <div className="space-y-2">
                                <Link
                                    href="/supplier/products"
                                    className="block w-full text-left px-4 py-3 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition-colors"
                                >
                                    <span className="text-sm font-medium text-white">Add New Product</span>
                                </Link>
                                <Link
                                    href="/supplier/vendors"
                                    className="block w-full text-left px-4 py-3 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition-colors"
                                >
                                    <span className="text-sm font-medium text-white">View Vendor Connections</span>
                                </Link>
                                <Link
                                    href="/supplier/orders"
                                    className="block w-full text-left px-4 py-3 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition-colors"
                                >
                                    <span className="text-sm font-medium text-white">View Orders</span>
                                </Link>
                            </div>
                        </div>

                        <div className="bg-white/5 rounded-xl p-6 border border-white/10 backdrop-blur-sm">
                            <h3 className="text-lg font-bold text-white mb-2">Recent Activity (7 days)</h3>
                            <div className="space-y-3">
                                {stats.pendingConnections > 0 && (
                                    <div className="flex items-center gap-3 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                                        <Clock className="w-5 h-5 text-yellow-400" />
                                        <div className="flex-1">
                                            <p className="text-sm font-medium text-white">{stats.pendingConnections} pending connection{stats.pendingConnections !== 1 ? "s" : ""}</p>
                                            <Link href="/supplier/vendors" className="text-xs text-yellow-400 hover:underline">
                                                Review now →
                                            </Link>
                                        </div>
                                    </div>
                                )}
                                {stats.recentProducts > 0 && (
                                    <div className="flex items-center gap-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                                        <div className="flex-1">
                                            <p className="text-sm font-medium text-white">{stats.recentProducts} new product{stats.recentProducts !== 1 ? "s" : ""} added</p>
                                            <Link href="/supplier/products" className="text-xs text-emerald-400 hover:underline">
                                                View products →
                                            </Link>
                                        </div>
                                    </div>
                                )}
                                {stats.recentConnections > 0 && (
                                    <div className="flex items-center gap-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                                        <Users className="w-5 h-5 text-blue-400" />
                                        <div className="flex-1">
                                            <p className="text-sm font-medium text-white">{stats.recentConnections} new connection{stats.recentConnections !== 1 ? "s" : ""}</p>
                                            <Link href="/supplier/vendors" className="text-xs text-blue-400 hover:underline">
                                                View vendors →
                                            </Link>
                                        </div>
                                    </div>
                                )}
                                {stats.pendingConnections === 0 && stats.recentProducts === 0 && stats.recentConnections === 0 && (
                                    <p className="text-sm text-slate-400">No recent activity</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Performance Overview */}
                    <div className="bg-white/5 rounded-xl p-6 border border-white/10 backdrop-blur-sm">
                        <h3 className="text-lg font-bold text-white mb-4">Performance Overview</h3>
                        <p className="text-sm text-slate-400 mb-4">
                            Key metrics at a glance.
                        </p>
                        <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={[
                                        { label: "Products", value: stats.totalProducts, color: "rgb(52 211 153)" },
                                        { label: "Vendors", value: stats.connectedVendors, color: "rgb(147 51 234)" },
                                        { label: "Pending", value: stats.pendingConnections, color: "rgb(251 191 36)" },
                                        { label: "New (7d)", value: stats.recentProducts + stats.recentConnections, color: "rgb(59 130 246)" }
                                    ]}
                                    margin={{ top: 12, right: 12, left: 0, bottom: 0 }}
                                >
                                    <XAxis dataKey="label" tick={{ fill: "rgb(148 163 184)", fontSize: 12 }} />
                                    <YAxis tick={{ fill: "rgb(148 163 184)", fontSize: 12 }} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: "rgb(30 41 59)", border: "1px solid rgb(51 65 85)", borderRadius: "8px", color: "rgb(248 250 252)" }}
                                        labelStyle={{ color: "rgb(248 250 252)" }}
                                        itemStyle={{ color: "rgb(248 250 252)" }}
                                        formatter={(value) => {
                                            const num =
                                                typeof value === "number" ? value : Number(value)
                                            return [Number.isFinite(num) ? num : 0, "Count"]
                                        }}
                                    />
                                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                        {[0, 1, 2, 3].map((i) => (
                                            <Cell key={i} fill={["rgb(52 211 153)", "rgb(147 51 234)", "rgb(251 191 36)", "rgb(59 130 246)"][i]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <p className="text-xs text-slate-500 mt-2">Products, connected vendors, pending connections, and new activity (last 7 days)</p>
                    </div>
                </>
            )}
        </div>
    )
}
