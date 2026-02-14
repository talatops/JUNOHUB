"use client"

import { useEffect, useState } from "react"
import {
    TrendingUp,
    Package,
    ShoppingCart,
    Users,
    ArrowUpRight,
    Loader2,
    Calendar,
    ChevronDown
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
import { useTheme } from "@/components/ThemeProvider"
import { cn } from "@/lib/utils"

type TimeRange = "7days" | "30days" | "1year"

export default function DashboardPage() {
    const { theme } = useTheme()
    const isLight = theme === "light"
    const [stats, setStats] = useState([
        { label: "Total Sales", value: "$0.00", icon: TrendingUp, color: "text-indigo-600", bg: "bg-indigo-100" },
        { label: "Active Products", value: "0", icon: Package, color: "text-emerald-600", bg: "bg-emerald-100" },
        { label: "Total Orders", value: "0", icon: ShoppingCart, color: "text-blue-600", bg: "bg-blue-100" },
        { label: "Customers", value: "0", icon: Users, color: "text-orange-600", bg: "bg-orange-100" },
    ])
    const [chartData, setChartData] = useState<{ date: string; amount: number }[]>([])
    const [loading, setLoading] = useState(true)
    const [timeRange, setTimeRange] = useState<TimeRange>("7days")

    const fetchDashboardData = async () => {
        try {
            setLoading(true)
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

            const orders = ordersData.orders || []
            const totalSales = orders.reduce((sum: number, order: { total_price?: string }) => sum + parseFloat(order.total_price ?? "0"), 0) || 0

            // Helper to generate date range
            const generateDateRange = (range: TimeRange) => {
                const dates = []
                const now = new Date()

                if (range === "1year") {
                    for (let i = 11; i >= 0; i--) {
                        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
                        dates.push(d.toLocaleDateString("en-US", { month: "short", year: "2-digit" }))
                    }
                } else {
                    const count = range === "30days" ? 30 : 7
                    for (let i = count - 1; i >= 0; i--) {
                        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
                        dates.push(d.toLocaleDateString("en-US", { month: "short", day: "numeric" }))
                    }
                }
                return dates
            }

            const rangeLabels = generateDateRange(timeRange)
            const salesByDate: Record<string, number> = {}

            orders.forEach((order: { created_at?: string; total_price?: string }) => {
                const orderDate = new Date(order.created_at ?? "")
                let label = ""
                if (timeRange === "1year") {
                    label = orderDate.toLocaleDateString("en-US", { month: "short", year: "2-digit" })
                } else {
                    label = orderDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })
                }

                if (rangeLabels.includes(label)) {
                    salesByDate[label] = (salesByDate[label] || 0) + parseFloat(order.total_price ?? "0")
                }
            })

            const processedChartData = rangeLabels.map(date => ({
                date,
                amount: Math.round((salesByDate[date] || 0) * 100) / 100
            }))

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

    useEffect(() => {
        fetchDashboardData()
    }, [timeRange])

    const statCardStyle: Record<string, { bg: string; icon: string; lightBg: string; lightIcon: string }> = {
        "Total Sales": {
            bg: "bg-indigo-500/20 border-indigo-400/30",
            icon: "text-indigo-400",
            lightBg: "bg-indigo-50 border-indigo-100",
            lightIcon: "text-indigo-600"
        },
        "Active Products": {
            bg: "bg-emerald-500/20 border-emerald-400/30",
            icon: "text-emerald-400",
            lightBg: "bg-emerald-50 border-emerald-100",
            lightIcon: "text-emerald-600"
        },
        "Total Orders": {
            bg: "bg-blue-500/20 border-blue-400/30",
            icon: "text-blue-400",
            lightBg: "bg-blue-50 border-blue-100",
            lightIcon: "text-blue-600"
        },
        "Customers": {
            bg: "bg-orange-500/20 border-orange-400/30",
            icon: "text-orange-400",
            lightBg: "bg-orange-50 border-orange-100",
            lightIcon: "text-orange-600"
        },
    }

    return (
        <div className="space-y-6 md:space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className={cn("text-2xl md:text-3xl font-extrabold tracking-tight", isLight ? "text-slate-900" : "text-white")}>
                        Overview
                    </h1>
                    <p className={cn("text-sm md:text-base mt-1", isLight ? "text-slate-500" : "text-slate-400")}>
                        Welcome back! Here&apos;s a quick look at your live Shopify stats.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative group">
                        <select
                            value={timeRange}
                            onChange={(e) => setTimeRange(e.target.value as TimeRange)}
                            className={cn(
                                "appearance-none h-11 pl-10 pr-10 rounded-xl font-bold border transition-all text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/20",
                                isLight
                                    ? "bg-white border-slate-200 text-slate-700 hover:border-slate-300 shadow-sm"
                                    : "bg-white/10 border-white/10 text-white hover:bg-white/15 backdrop-blur-sm"
                            )}
                        >
                            <option value="7days">Last 7 Days</option>
                            <option value="30days">Last 1 Month</option>
                            <option value="1year">Last 1 Year</option>
                        </select>
                        <Calendar className={cn("absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4", isLight ? "text-slate-400" : "text-slate-400")} />
                        <ChevronDown className={cn("absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none", isLight ? "text-slate-400" : "text-slate-400")} />
                    </div>
                    <button className={cn(
                        "h-11 px-4 md:px-6 rounded-xl font-bold flex items-center justify-center gap-2 border transition-all text-sm md:text-base shrink-0",
                        isLight
                            ? "bg-indigo-600 text-white border-indigo-700 hover:bg-indigo-700 shadow-sm"
                            : "bg-white/10 text-white border-white/10 hover:bg-white/15 backdrop-blur-sm"
                    )}>
                        Export <ArrowUpRight className="hidden sm:block w-4 h-4" />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                {stats.map((stat: (typeof stats)[number]) => (
                    <div key={stat.label} className={cn(
                        "p-4 md:p-6 rounded-xl md:rounded-2xl border flex items-center gap-4 md:gap-6 transition-all hover:translate-y-[-2px]",
                        isLight
                            ? "bg-white border-slate-100 shadow-sm hover:shadow-md"
                            : "bg-white/5 border-white/10 backdrop-blur-xl hover:bg-white/[0.07]"
                    )}>
                        <div className={cn(
                            "w-12 h-12 md:w-14 md:h-14 rounded-xl md:rounded-2xl border flex items-center justify-center shrink-0 shadow-inner",
                            isLight ? statCardStyle[stat.label]?.lightBg : statCardStyle[stat.label]?.bg,
                            isLight ? statCardStyle[stat.label]?.lightIcon : statCardStyle[stat.label]?.icon
                        )}>
                            {loading ? <Loader2 className="w-6 h-6 md:w-7 md:h-7 animate-spin" /> : <stat.icon className="w-6 h-6 md:w-7 md:h-7" />}
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className={cn("text-[10px] uppercase font-bold tracking-widest", isLight ? "text-slate-500" : "text-slate-400")}>
                                {stat.label}
                            </p>
                            <p className={cn(
                                "text-xl md:text-2xl font-black tracking-tight truncate",
                                isLight ? "text-slate-900" : "text-white",
                                loading && "animate-pulse opacity-50"
                            )}>
                                {stat.value}
                            </p>
                        </div>
                    </div>
                ))}
            </div>

            <div className={cn(
                "p-4 md:p-8 rounded-xl md:rounded-2xl border transition-all",
                isLight ? "bg-white border-slate-100 shadow-sm" : "bg-white/5 border-white/10 backdrop-blur-xl"
            )}>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 md:mb-8">
                    <div>
                        <h3 className={cn("text-lg md:text-xl font-bold font-display", isLight ? "text-slate-900" : "text-white")}>
                            Recent Sales Trend
                        </h3>
                        <p className={cn("text-xs mt-1", isLight ? "text-slate-500" : "text-slate-400")}>
                            Revenue analysis over time
                        </p>
                    </div>
                    <div className="flex items-center gap-2 bg-slate-100 dark:bg-white/5 p-1 rounded-lg w-fit">
                        {(["7days", "30days", "1year"] as const).map((r) => (
                            <button
                                key={r}
                                onClick={() => setTimeRange(r)}
                                className={cn(
                                    "px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all",
                                    timeRange === r
                                        ? "bg-white dark:bg-indigo-600 text-indigo-600 dark:text-white shadow-sm"
                                        : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white"
                                )}
                            >
                                {r === "7days" ? "7D" : r === "30days" ? "1M" : "1Y"}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="h-[250px] md:h-[350px] w-full">
                    {loading ? (
                        <div className="w-full h-full flex items-center justify-center rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5">
                            <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
                        </div>
                    ) : chartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#818cf8" stopOpacity={isLight ? 0.3 : 0.25} />
                                        <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid
                                    strokeDasharray="3 3"
                                    vertical={false}
                                    stroke={isLight ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.06)"}
                                />
                                <XAxis
                                    dataKey="date"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: isLight ? "#64748b" : "#94a3b8", fontSize: 10, fontWeight: 600 }}
                                    dy={10}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: isLight ? "#64748b" : "#94a3b8", fontSize: 10, fontWeight: 600 }}
                                    tickFormatter={(val) => `$${val > 999 ? (val / 1000).toFixed(1) + "k" : val}`}
                                />
                                <Tooltip
                                    contentStyle={{
                                        borderRadius: "12px",
                                        border: isLight ? "1px solid #e2e8f0" : "1px solid rgba(255,255,255,0.1)",
                                        background: isLight ? "#ffffff" : "#0f172a",
                                        color: isLight ? "#1e293b" : "#f1f5f9",
                                        fontWeight: 700,
                                        boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
                                        backdropFilter: isLight ? "none" : "blur(12px)",
                                    }}
                                    formatter={(value: number | undefined) => [value !== undefined ? `$${value.toLocaleString()}` : "$0", "Revenue"]}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="amount"
                                    stroke="#4f46e5"
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#colorAmount)"
                                    animationDuration={1500}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="w-full h-full flex items-center justify-center rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 text-slate-400 font-semibold italic">
                            No sales data found for this period.
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
