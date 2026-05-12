"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import {
    TrendingUp,
    ArrowUpRight,
    Loader2,
    Calendar,
    ChevronDown,
    Package,
    ShoppingCart,
    Users,
    Lightbulb,
    TrendingDown,
    Minus,
    Sparkles,
} from "lucide-react"
import {
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    AreaChart,
    Area,
    LineChart,
    Line,
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
    Legend,
} from "recharts"
import { useTheme } from "@/components/ThemeProvider"
import { chartTooltipProps } from "@/lib/charts/rechartsTooltip"
import { cn } from "@/lib/utils"

type TimeRange = "7days" | "30days" | "1year"

type BusinessMetricsPayload = {
    currency: string
    range?: TimeRange
    comparisonLabel?: string
    disclaimer: string
    kpis: {
        key: string
        label: string
        value: number
        changePct: number
        suffix?: string
        sparkline: number[]
    }[]
    monthlyProfitBars: { month: string; profit: number }[]
    feeDonut: { name: string; value: number }[]
    feeTotal: number
    productMargins: {
        product: string
        unitsSold: number
        cogs: number
        netProfit: number
        marginPct: number
        trend: "up" | "down" | "flat"
        refundUnits: number
    }[]
    aiInsight: string
    totals: { gross: number; refunds: number; orders: number }
}

function formatMoney(amount: number, currency: string) {
    try {
        return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(amount)
    } catch {
        return `${currency} ${amount.toFixed(0)}`
    }
}

function sinceForRange(range: TimeRange) {
    const now = new Date()
    if (range === "1year") {
        return new Date(now.getFullYear(), now.getMonth() - 11, 1)
    }
    const days = range === "30days" ? 30 : 7
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1))
}

function orderDate(order: { created_at?: string; shopifyCreatedAt?: string; createdAt?: string }) {
    const raw = order.created_at ?? order.shopifyCreatedAt ?? order.createdAt ?? ""
    const date = new Date(raw)
    return Number.isNaN(date.getTime()) ? null : date
}

function MiniSpark({
    data,
    color,
}: {
    data: number[]
    color: string
}) {
    const pts = data.map((y, i) => ({ i, y }))
    return (
        <div className="absolute top-3 right-3 w-[100px] h-[36px] opacity-90">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={pts} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
                    <Line type="monotone" dataKey="y" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
            </ResponsiveContainer>
        </div>
    )
}

export default function DashboardPage() {
    const { theme } = useTheme()
    const isLight = theme === "light"
    const [snapshot, setSnapshot] = useState({
        totalSales: 0,
        products: 0,
        orders: 0,
        customers: 0,
    })
    const [business, setBusiness] = useState<BusinessMetricsPayload | null>(null)
    const [chartData, setChartData] = useState<{ date: string; amount: number }[]>([])
    const [loading, setLoading] = useState(true)
    const [bizErr, setBizErr] = useState<string | null>(null)
    const [timeRange, setTimeRange] = useState<TimeRange>("7days")

    const fetchDashboardData = useCallback(async () => {
        try {
            setLoading(true)
            const [productsRes, ordersRes, customersRes] = await Promise.all([
                fetch("/api/shopify/inventory").catch(() => ({
                    ok: false,
                    json: async () => ({ products: [], message: "Failed to fetch products" }),
                })),
                fetch("/api/shopify/orders").catch(() => ({
                    ok: false,
                    json: async () => ({ orders: [], message: "Failed to fetch orders" }),
                })),
                fetch("/api/shopify/customers").catch(() => ({
                    ok: false,
                    json: async () => ({ customers: [], message: "Failed to fetch customers" }),
                })),
            ])

            const [productsData, ordersData, customersData] = await Promise.all([
                productsRes.json().catch(() => ({ products: [] })),
                ordersRes.json().catch(() => ({ orders: [] })),
                customersRes.json().catch(() => ({ customers: [] })),
            ])

            try {
                const bizRes = await fetch(`/api/dashboard/business-metrics?range=${encodeURIComponent(timeRange)}`)
                const j = await bizRes.json().catch(() => null)
                if (bizRes.ok && j && typeof j === "object" && !("message" in j && typeof j.message === "string")) {
                    setBusiness(j as BusinessMetricsPayload)
                    setBizErr(null)
                } else {
                    setBusiness(null)
                    setBizErr(typeof j?.message === "string" ? j.message : null)
                }
            } catch {
                setBusiness(null)
                setBizErr(null)
            }

            const orders = ordersData.orders || []
            const since = sinceForRange(timeRange)
            const filteredOrders = orders.filter((order: { created_at?: string; shopifyCreatedAt?: string; createdAt?: string }) => {
                const d = orderDate(order)
                return d ? d >= since : false
            })
            const totalSales =
                filteredOrders.reduce((sum: number, order: { total_price?: string }) => sum + parseFloat(order.total_price ?? "0"), 0) || 0

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

            filteredOrders.forEach((order: { created_at?: string; shopifyCreatedAt?: string; createdAt?: string; total_price?: string }) => {
                const createdAt = orderDate(order)
                if (!createdAt) return
                let label = ""
                if (timeRange === "1year") {
                    label = createdAt.toLocaleDateString("en-US", { month: "short", year: "2-digit" })
                } else {
                    label = createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })
                }

                if (rangeLabels.includes(label)) {
                    salesByDate[label] = (salesByDate[label] || 0) + parseFloat(order.total_price ?? "0")
                }
            })

            const processedChartData = rangeLabels.map((date) => ({
                date,
                amount: Math.round((salesByDate[date] || 0) * 100) / 100,
            }))

            setChartData(processedChartData)
            setSnapshot({
                totalSales,
                products: productsData.products?.length ?? 0,
                orders: filteredOrders.length,
                customers: customersData.customers?.length ?? 0,
            })
        } catch (error) {
            console.error("Dashboard stats fetch error:", error)
        } finally {
            setLoading(false)
        }
    }, [timeRange])

    useEffect(() => {
        void fetchDashboardData()
    }, [fetchDashboardData])

    const currency = business?.currency ?? "USD"
    const gridStroke = isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.08)"
    const chartMuted = isLight ? "#64748b" : "#94a3b8"
    const chartTt = chartTooltipProps(isLight)
    const donutColors = ["#6366f1", "#a855f7", "#f43f5e", "#f97316"]

    const kpiAccent: Record<string, string> = {
        netProfit: "#22c55e",
        grossRevenue: "#3b82f6",
        fees: "#f43f5e",
        margin: "#22c55e",
    }

    return (
        <div className="w-full max-w-none space-y-5 md:space-y-7">
            <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
                <div>
                    <h1 className={cn("text-2xl md:text-3xl font-extrabold tracking-tight", isLight ? "text-slate-900" : "text-white")}>
                        Overview
                    </h1>
                    <p className={cn("text-sm md:text-base mt-1", isLight ? "text-slate-500" : "text-slate-400")}>
                        Shopify snapshot plus estimated profit, fees, and product economics from your synced orders.
                    </p>
                    <div className="flex flex-wrap gap-2 mt-3">
                        <span
                            className={cn(
                                "text-[11px] font-bold px-2.5 py-1 rounded-lg border",
                                isLight ? "bg-slate-50 border-slate-200 text-slate-600" : "bg-white/5 border-white/10 text-slate-300",
                            )}
                        >
                            {snapshot.orders} orders
                        </span>
                        <span
                            className={cn(
                                "text-[11px] font-bold px-2.5 py-1 rounded-lg border",
                                isLight ? "bg-slate-50 border-slate-200 text-slate-600" : "bg-white/5 border-white/10 text-slate-300",
                            )}
                        >
                            {snapshot.products} products
                        </span>
                        <span
                            className={cn(
                                "text-[11px] font-bold px-2.5 py-1 rounded-lg border",
                                isLight ? "bg-slate-50 border-slate-200 text-slate-600" : "bg-white/5 border-white/10 text-slate-300",
                            )}
                        >
                            {snapshot.customers} customers
                        </span>
                        <Link
                            href="/dashboard/ai-analytics"
                            className={cn(
                                "text-[11px] font-bold px-2.5 py-1 rounded-lg border inline-flex items-center gap-1 transition-colors",
                                isLight
                                    ? "bg-indigo-50 border-indigo-100 text-indigo-700 hover:bg-indigo-100"
                                    : "bg-indigo-500/10 border-indigo-400/30 text-indigo-200 hover:bg-indigo-500/20",
                            )}
                        >
                            <Sparkles className="w-3 h-3" />
                            AI analytics
                        </Link>
                    </div>
                </div>
                <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
                    <div className="relative group w-full sm:w-auto">
                        <select
                            value={timeRange}
                            onChange={(e) => setTimeRange(e.target.value as TimeRange)}
                            className={cn(
                                "w-full appearance-none h-11 pl-10 pr-10 rounded-xl font-bold border transition-all text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/20 sm:w-auto",
                                isLight
                                    ? "bg-white border-slate-200 text-slate-700 hover:border-slate-300 shadow-sm"
                                    : "bg-white/10 border-white/10 text-white hover:bg-white/15 backdrop-blur-sm",
                            )}
                        >
                            <option value="7days">Last 7 Days</option>
                            <option value="30days">Last 1 Month</option>
                            <option value="1year">Last 1 Year</option>
                        </select>
                        <Calendar
                            className={cn("absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4", isLight ? "text-slate-400" : "text-slate-400")}
                        />
                        <ChevronDown
                            className={cn(
                                "absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none",
                                isLight ? "text-slate-400" : "text-slate-400",
                            )}
                        />
                    </div>
                    <button
                        type="button"
                        className={cn(
                            "h-11 w-full px-4 md:px-6 rounded-xl font-bold flex items-center justify-center gap-2 border transition-all text-sm md:text-base shrink-0 sm:w-auto",
                            isLight
                                ? "bg-indigo-600 text-white border-indigo-700 hover:bg-indigo-700 shadow-sm"
                                : "bg-white/10 text-white border-white/10 hover:bg-white/15 backdrop-blur-sm",
                        )}
                    >
                        Export <ArrowUpRight className="hidden sm:block w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Financial KPI row — Image 2 style */}
            <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-4 gap-3 md:gap-4">
                {(business?.kpis ?? []).map((kpi) => (
                    <div
                        key={kpi.key}
                        className={cn(
                            "relative overflow-hidden p-4 md:p-6 rounded-xl md:rounded-2xl border transition-all hover:translate-y-[-2px]",
                            isLight ? "bg-white border-slate-100 shadow-sm hover:shadow-md" : "bg-white/5 border-white/10 backdrop-blur-xl",
                        )}
                    >
                        <MiniSpark data={kpi.sparkline} color={kpiAccent[kpi.key] ?? "#6366f1"} />
                        <p className={cn("text-[10px] uppercase font-bold tracking-widest pr-24", isLight ? "text-slate-500" : "text-slate-400")}>
                            {kpi.label}
                        </p>
                        <p className={cn("text-xl md:text-2xl font-black tracking-tight mt-2", isLight ? "text-slate-900" : "text-white")}>
                            {loading && !business ? (
                                <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
                            ) : kpi.suffix ? (
                                `${kpi.value.toFixed(1)}${kpi.suffix}`
                            ) : (
                                formatMoney(kpi.value, currency)
                            )}
                        </p>
                        <p
                            className={cn(
                                "text-xs font-bold mt-2 flex items-center gap-1",
                                kpi.changePct >= 0 ? "text-emerald-500" : "text-rose-400",
                            )}
                        >
                            <TrendingUp className={cn("w-3.5 h-3.5", kpi.changePct < 0 && "rotate-180")} />
                            {kpi.changePct >= 0 ? "+" : ""}
                            {kpi.changePct}% vs {business?.comparisonLabel ?? "prior period"}
                        </p>
                    </div>
                ))}
                {!business && !loading && (
                    <div
                        className={cn(
                            "sm:col-span-2 xl:col-span-4 rounded-2xl border p-6 text-sm font-medium",
                            isLight ? "bg-amber-50 border-amber-100 text-amber-900" : "bg-amber-950/30 border-amber-900/40 text-amber-100",
                        )}
                    >
                        {bizErr
                            ? `Could not load estimated profit metrics: ${bizErr}.`
                            : "Estimated profit and fee cards will appear once synced order history is available for your active store."}
                    </div>
                )}
            </div>

            {/* Profit bars + fee donut */}
            {business && (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-5">
                    <div
                        className={cn(
                            "p-4 md:p-5 rounded-xl md:rounded-2xl border min-h-[300px]",
                            isLight ? "bg-white border-slate-100 shadow-sm" : "bg-white/5 border-white/10 backdrop-blur-xl",
                        )}
                    >
                        <h3 className={cn("text-lg font-bold", isLight ? "text-slate-900" : "text-white")}>Monthly profit (est.)</h3>
                        <p className={cn("text-xs mt-1 mb-4", isLight ? "text-slate-500" : "text-slate-400")}>
                            Based on gross revenue × assumed net margin ({business.disclaimer.slice(0, 80)}…)
                        </p>
                        <div className="w-full overflow-x-auto">
                            <div className="h-[220px] min-w-[560px] md:min-w-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={business.monthlyProfitBars} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                                    <XAxis dataKey="month" tick={{ fill: chartMuted, fontSize: 11, fontWeight: 600 }} axisLine={false} tickLine={false} dy={8} />
                                    <YAxis
                                        tick={{ fill: chartMuted, fontSize: 10, fontWeight: 600 }}
                                        axisLine={false}
                                        tickLine={false}
                                        tickFormatter={(v) => formatMoney(Number(v), currency)}
                                    />
                                    <Tooltip
                                        {...chartTt}
                                        formatter={(v) => [formatMoney(Number(v ?? 0), currency), "Profit (est.)"]}
                                    />
                                    <Bar dataKey="profit" fill="#22c55e" radius={[6, 6, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    <div
                        className={cn(
                            "p-4 md:p-5 rounded-xl md:rounded-2xl border min-h-[300px]",
                            isLight ? "bg-white border-slate-100 shadow-sm" : "bg-white/5 border-white/10 backdrop-blur-xl",
                        )}
                    >
                        <h3 className={cn("text-lg font-bold", isLight ? "text-slate-900" : "text-white")}>Fee breakdown (est.)</h3>
                        <p className={cn("text-xs mt-1 mb-2", isLight ? "text-slate-500" : "text-slate-400")}>
                            Total estimated fees {formatMoney(business.feeTotal, currency)}
                        </p>
                        <div className="h-[240px] w-full min-w-0 flex items-center justify-center">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={business.feeDonut}
                                        dataKey="value"
                                        nameKey="name"
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={58}
                                        outerRadius={88}
                                        paddingAngle={2}
                                    >
                                        {business.feeDonut.map((_, i) => (
                                            <Cell key={i} fill={donutColors[i % donutColors.length]} />
                                        ))}
                                    </Pie>
                                    <Legend
                                        verticalAlign="middle"
                                        align="right"
                                        layout="vertical"
                                        wrapperStyle={{ fontSize: 11, fontWeight: 600, color: chartMuted }}
                                    />
                                    <Tooltip {...chartTt} formatter={(v) => formatMoney(Number(v ?? 0), currency)} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            )}

            {/* Snapshot icons row — compact */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
                {[
                    { label: "Live revenue (period)", value: formatMoney(snapshot.totalSales, currency), icon: TrendingUp },
                    { label: "Catalog size", value: String(snapshot.products), icon: Package },
                    { label: "Orders in sync", value: String(snapshot.orders), icon: ShoppingCart },
                    { label: "Customers", value: String(snapshot.customers), icon: Users },
                ].map((row) => (
                    <div
                        key={row.label}
                        className={cn(
                            "flex items-center gap-3 p-4 rounded-xl border",
                            isLight ? "bg-white/80 border-slate-100" : "bg-white/[0.04] border-white/10",
                        )}
                    >
                        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", isLight ? "bg-indigo-50 text-indigo-600" : "bg-white/10 text-indigo-300")}>
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <row.icon className="w-5 h-5" />}
                        </div>
                        <div className="min-w-0">
                            <p className={cn("text-[10px] uppercase font-bold tracking-wide", isLight ? "text-slate-500" : "text-slate-400")}>{row.label}</p>
                            <p className={cn("text-lg font-black truncate", isLight ? "text-slate-900" : "text-white")}>{row.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Product margins + AI insight */}
            {business && business.productMargins.length > 0 && (
                <div
                    className={cn(
                        "rounded-xl md:rounded-2xl border overflow-hidden",
                        isLight ? "bg-white border-slate-100 shadow-sm" : "bg-white/5 border-white/10 backdrop-blur-xl",
                    )}
                >
                    <div className={cn("px-4 md:px-6 py-4 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2", isLight ? "border-slate-100" : "border-white/10")}>
                        <h3 className={cn("text-lg font-bold", isLight ? "text-slate-900" : "text-white")}>Product-level margins (est.)</h3>
                    </div>
                    <div className="table-horizontal-scroll overflow-x-auto">
                        <table className="w-full text-sm min-w-[520px]">
                            <thead>
                                <tr className={cn("text-left text-[10px] uppercase font-bold tracking-wider", isLight ? "bg-slate-50 text-slate-500" : "bg-white/[0.06] text-slate-400")}>
                                    <th className="px-4 py-3">Product</th>
                                    <th className="px-4 py-3">Units</th>
                                    <th className="px-4 py-3">Est. COGS</th>
                                    <th className="px-4 py-3">Est. net</th>
                                    <th className="px-4 py-3">Margin</th>
                                    <th className="px-4 py-3">Trend</th>
                                </tr>
                            </thead>
                            <tbody>
                                {business.productMargins.map((r) => (
                                    <tr key={r.product} className={cn("border-t", isLight ? "border-slate-100" : "border-white/10")}>
                                        <td className={cn("px-4 py-3 font-semibold max-w-[200px] truncate", isLight ? "text-slate-900" : "text-white")}>
                                            {r.product}
                                        </td>
                                        <td className={cn("px-4 py-3", isLight ? "text-slate-600" : "text-slate-300")}>{r.unitsSold}</td>
                                        <td className={cn("px-4 py-3", isLight ? "text-slate-600" : "text-slate-300")}>{formatMoney(r.cogs, currency)}</td>
                                        <td className={cn("px-4 py-3 font-bold", isLight ? "text-emerald-700" : "text-emerald-400")}>
                                            {formatMoney(r.netProfit, currency)}
                                        </td>
                                        <td className={cn("px-4 py-3 font-bold", isLight ? "text-slate-800" : "text-slate-200")}>{r.marginPct}%</td>
                                        <td className="px-4 py-3">
                                            {r.trend === "up" && <TrendingUp className="w-5 h-5 text-emerald-500" />}
                                            {r.trend === "down" && <TrendingDown className="w-5 h-5 text-rose-400" />}
                                            {r.trend === "flat" && <Minus className="w-5 h-5 text-amber-400" />}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div
                        className={cn(
                            "px-4 md:px-6 py-4 flex gap-3 items-start border-t",
                            isLight ? "bg-amber-50/90 border-amber-100" : "bg-amber-950/25 border-amber-900/30",
                        )}
                    >
                        <Lightbulb className={cn("w-5 h-5 shrink-0 mt-0.5", isLight ? "text-amber-600" : "text-amber-300")} />
                        <p className={cn("text-sm font-medium leading-relaxed", isLight ? "text-amber-950" : "text-amber-50")}>
                            {business.aiInsight}
                        </p>
                    </div>
                </div>
            )}

            <div
                className={cn(
                    "p-4 md:p-5 rounded-xl md:rounded-2xl border transition-all",
                    isLight ? "bg-white border-slate-100 shadow-sm" : "bg-white/5 border-white/10 backdrop-blur-xl",
                )}
            >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5 md:mb-6">
                    <div>
                        <h3 className={cn("text-lg md:text-xl font-bold font-display", isLight ? "text-slate-900" : "text-white")}>
                            Recent Sales Trend
                        </h3>
                        <p className={cn("text-xs mt-1", isLight ? "text-slate-500" : "text-slate-400")}>Revenue analysis over time</p>
                    </div>
                    <div className="flex w-full items-center gap-2 overflow-x-auto rounded-lg bg-slate-100 p-1 dark:bg-white/5 md:w-fit md:overflow-visible">
                        {(["7days", "30days", "1year"] as const).map((r) => (
                            <button
                                key={r}
                                type="button"
                                onClick={() => setTimeRange(r)}
                                className={cn(
                                    "shrink-0 px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all",
                                    timeRange === r
                                        ? "bg-white dark:bg-indigo-600 text-indigo-600 dark:text-white shadow-sm"
                                        : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white",
                                )}
                            >
                                {r === "7days" ? "7D" : r === "30days" ? "1M" : "1Y"}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="w-full overflow-x-auto">
                <div className="h-[250px] min-w-[620px] md:h-[350px] md:min-w-0">
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
                                    {...chartTt}
                                    contentStyle={{
                                        ...chartTt.contentStyle,
                                        backdropFilter: isLight ? "none" : "blur(12px)",
                                    }}
                                    formatter={(value) => {
                                        const num = typeof value === "number" ? value : Number(value)
                                        const v = Number.isFinite(num) ? num : 0
                                        return [`$${v.toLocaleString()}`, "Revenue"]
                                    }}
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
        </div>
    )
}
