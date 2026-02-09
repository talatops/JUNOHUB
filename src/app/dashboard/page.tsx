"use client"

import { useEffect, useState } from "react"
import {
    TrendingUp,
    Package,
    ShoppingCart,
    Users,
    ArrowUpRight,
    Loader2
} from "lucide-react"
import {
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    AreaChart,
    Area
} from "recharts"

export default function DashboardPage() {
    const [stats, setStats] = useState([
        { label: "Total Sales", value: "$0.00", icon: TrendingUp, color: "text-indigo-600", bg: "bg-indigo-100" },
        { label: "Active Products", value: "0", icon: Package, color: "text-emerald-600", bg: "bg-emerald-100" },
        { label: "Total Orders", value: "0", icon: ShoppingCart, color: "text-blue-600", bg: "bg-blue-100" },
        { label: "Customers", value: "0", icon: Users, color: "text-orange-600", bg: "bg-orange-100" },
    ])
    const [chartData, setChartData] = useState<{ date: string; amount: number }[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                const [productsRes, ordersRes, customersRes] = await Promise.all([
                    fetch("/api/shopify/inventory").catch(() => ({ ok: false, json: async () => ({ products: [], message: "Failed to fetch products" }) })),
                    fetch("/api/shopify/orders").catch(() => ({ ok: false, json: async () => ({ orders: [], message: "Failed to fetch orders" }) })),
                    fetch("/api/shopify/customers").catch(() => ({ ok: false, json: async () => ({ customers: [], message: "Failed to fetch customers" }) }))
                ])

                const [productsData, ordersData, customersData] = await Promise.all([
                    productsRes.json().catch(() => ({ products: [] })),
                    ordersRes.json().catch(() => ({ orders: [] })),
                    customersRes.json().catch(() => ({ customers: [] }))
                ])

                // Check for error messages
                if (productsData.message && !productsRes.ok) {
                    console.warn("Products fetch error:", productsData.message)
                }
                if (ordersData.message && !ordersRes.ok) {
                    console.warn("Orders fetch error:", ordersData.message)
                }
                if (customersData.message && !customersRes.ok) {
                    console.warn("Customers fetch error:", customersData.message)
                }

                const orders = ordersData.orders || []
                const totalSales = orders.reduce((sum: number, order: { total_price?: string }) => sum + parseFloat(order.total_price ?? "0"), 0) || 0

                // Process chart data (Recent 7 days sales)
                const salesByDate: Record<string, number> = {}
                orders.forEach((order: { created_at?: string; total_price?: string }) => {
                    const date = new Date(order.created_at ?? "").toLocaleDateString("en-US", { month: "short", day: "numeric" })
                    salesByDate[date] = (salesByDate[date] || 0) + parseFloat(order.total_price ?? "0")
                })

                const processedChartData = Object.entries(salesByDate)
                    .map(([date, amount]) => ({ date, amount }))
                    .slice(-7) // Last 7 days

                setChartData(processedChartData)

                setStats([
                    { label: "Total Sales", value: `$${totalSales.toLocaleString()}`, icon: TrendingUp, color: "text-indigo-600", bg: "bg-indigo-100" },
                    { label: "Active Products", value: productsData.products?.length.toString() || "0", icon: Package, color: "text-emerald-600", bg: "bg-emerald-100" },
                    { label: "Total Orders", value: orders.length.toString() || "0", icon: ShoppingCart, color: "text-blue-600", bg: "bg-blue-100" },
                    { label: "Customers", value: customersData.customers?.length.toString() || "0", icon: Users, color: "text-orange-600", bg: "bg-orange-100" },
                ])
            } catch (error) {
                console.error("Dashboard stats fetch error:", error)
            } finally {
                setLoading(false)
            }
        }
        fetchDashboardData()
    }, [])

    const statCardStyle: Record<string, { bg: string; icon: string }> = {
        "Total Sales": { bg: "bg-indigo-500/20 border-indigo-400/30", icon: "text-indigo-400" },
        "Active Products": { bg: "bg-emerald-500/20 border-emerald-400/30", icon: "text-emerald-400" },
        "Total Orders": { bg: "bg-blue-500/20 border-blue-400/30", icon: "text-blue-400" },
        "Customers": { bg: "bg-orange-500/20 border-orange-400/30", icon: "text-orange-400" },
    }

    return (
        <div className="space-y-6 md:space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">Overview</h1>
                    <p className="text-sm md:text-base text-slate-400 mt-1">Welcome back! Here&apos;s a quick look at your live Shopify stats.</p>
                </div>
                <button className="h-11 px-4 md:px-6 bg-white/10 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-white/15 border border-white/10 backdrop-blur-sm transition-all text-sm md:text-base shrink-0">
                    Export Report <ArrowUpRight className="w-4 h-4" />
                </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                {stats.map((stat: (typeof stats)[number]) => (
                    <div key={stat.label} className="bg-white/5 backdrop-blur-xl p-4 md:p-6 rounded-xl md:rounded-2xl border border-white/10 flex items-center gap-4 md:gap-6 hover:bg-white/[0.07] transition-colors">
                        <div className={`w-12 h-12 md:w-14 md:h-14 rounded-xl md:rounded-2xl border ${statCardStyle[stat.label]?.bg ?? "bg-indigo-500/20 border-indigo-400/30"} flex items-center justify-center shrink-0 ${statCardStyle[stat.label]?.icon ?? "text-indigo-400"}`}>
                            {loading ? <Loader2 className="w-6 h-6 md:w-7 md:h-7 animate-spin" /> : <stat.icon className="w-6 h-6 md:w-7 md:h-7" />}
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">{stat.label}</p>
                            <p className={`text-xl md:text-2xl font-black text-white tracking-tight truncate ${loading ? "animate-pulse opacity-50" : ""}`}>
                                {stat.value}
                            </p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="bg-white/5 backdrop-blur-xl p-4 md:p-8 rounded-xl md:rounded-2xl border border-white/10">
                <h3 className="text-lg md:text-xl font-bold text-white mb-4 md:mb-6 font-display">Recent Sales Trend</h3>
                <div className="h-[250px] md:h-[300px] w-full">
                    {loading ? (
                        <div className="w-full h-full flex items-center justify-center rounded-2xl bg-white/5 border border-white/5">
                            <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
                        </div>
                    ) : chartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#818cf8" stopOpacity={0.25} />
                                        <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" />
                                <XAxis
                                    dataKey="date"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: "#94a3b8", fontSize: 10, fontWeight: 600 }}
                                    dy={10}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: "#94a3b8", fontSize: 10, fontWeight: 600 }}
                                />
                                <Tooltip
                                    contentStyle={{
                                        borderRadius: "16px",
                                        border: "1px solid rgba(255,255,255,0.1)",
                                        background: "rgba(15, 23, 42, 0.9)",
                                        color: "#f1f5f9",
                                        fontWeight: 700,
                                        backdropFilter: "blur(12px)",
                                    }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="amount"
                                    stroke="#818cf8"
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#colorAmount)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="w-full h-full flex items-center justify-center rounded-2xl bg-white/5 border border-white/5 text-slate-400 font-semibold">
                            No sales data found for the last 7 days.
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
