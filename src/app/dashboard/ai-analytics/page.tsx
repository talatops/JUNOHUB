"use client"

import { useEffect, useMemo, useState } from "react"
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Legend,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts"
import { Loader2, Sparkles } from "lucide-react"
import { useTheme } from "@/components/ThemeProvider"
import { chartTooltipProps } from "@/lib/charts/rechartsTooltip"
import { cn } from "@/lib/utils"

type TimelineRow = {
    key: string
    label: string
    directUpsellRevenue: number
    directCrossSellRevenue: number
    aiAssistedRevenue: number
    questions: number
    resolvedByAi: number
    unresolvedQuestions: number
    ticketsCreated: number
    upsellShown: number
    upsellClicked: number
    cartActions: number
    positiveSentiment: number
    neutralSentiment: number
    negativeSentiment: number
    urgentSentiment: number
}

type AiAnalyticsPayload = {
    generatedAt: string
    range: string
    grain: string
    revenueImpact: {
        currency: string
        directUpsellRevenue: number
        directCrossSellRevenue: number
        aiAssistedRevenue: number
        aiCartConversionRate: number
        averageAiInfluencedOrderValue: number
        pendingAttributionCount: number
        methodology: string
    }
    customerExperience: {
        sentimentMix: {
            totals: Record<"positive" | "neutral" | "negative" | "urgent" | "unknown", number>
            percentages: Record<"positive" | "neutral" | "negative" | "urgent" | "unknown", number>
        }
        unresolvedQuestionRate: number
        escalationRate: number
        unresolvedQuestions: number
        ticketsCreated: number
        negativeOrUrgent: number
    }
    automationOutcomes: {
        questionsAnswered: number
        aiAnswers: number
        resolvedByAi: number
        ticketsCreated: number
        aiMedianSeconds: number
        manualMedianMinutes: number
        sampleAiPairs: number
        sampleManualPairs: number
        hoursSavedEstimate: number
        resolutionRate: number
    }
    demandSignals: {
        curiousProductQuestionCount: number
        topProductQuestions: { name: string; count: number }[]
        highInterestProducts: { name: string; count: number }[]
        questionMix: { name: string; count: number }[]
    }
    timeline: TimelineRow[]
    technicalDiagnostics: {
        hiddenByDefault: boolean
        storefrontAiMessages: number
        storefrontCustomerMessages: number
        analyticsEvents: number
        cachedOrders: number
    }
}

const RANGE_OPTIONS = [
    { value: "today", label: "Today" },
    { value: "7d", label: "7 days" },
    { value: "30d", label: "30 days" },
    { value: "90d", label: "90 days" },
    { value: "12m", label: "12 months" },
    { value: "year", label: "Year" },
    { value: "all", label: "All" },
] as const

const SENTIMENT_COLORS = {
    positive: "#22c55e",
    neutral: "#94a3b8",
    negative: "#f97316",
    urgent: "#ef4444",
}

function formatMoney(amount: number, currency: string) {
    try {
        return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount)
    } catch {
        return `${currency} ${amount.toFixed(2)}`
    }
}

function formatPercent(value: number) {
    return `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`
}

function EmptyState({ children, isLight }: { children: string; isLight: boolean }) {
    return (
        <div className={cn("rounded-xl border p-6 text-sm text-center", isLight ? "border-slate-100 bg-slate-50 text-slate-500" : "border-white/10 bg-white/[0.04] text-slate-400")}>
            {children}
        </div>
    )
}

function MetricCard({
    title,
    value,
    helper,
    accent,
    isLight,
}: {
    title: string
    value: string
    helper: string
    accent: string
    isLight: boolean
}) {
    return (
        <div className={cn("rounded-2xl border p-4 md:p-5", isLight ? "bg-white border-slate-100 shadow-sm" : "bg-white/5 border-white/10")}>
            <p className={cn("text-[11px] uppercase tracking-widest font-black", isLight ? "text-slate-500" : "text-slate-400")}>
                {title}
            </p>
            <p className={cn("text-2xl md:text-3xl font-black mt-2 tabular-nums", accent)}>{value}</p>
            <p className={cn("text-xs mt-2 leading-relaxed", isLight ? "text-slate-500" : "text-slate-400")}>{helper}</p>
        </div>
    )
}

export default function AiAnalyticsPage() {
    const { theme } = useTheme()
    const isLight = theme === "light"
    const [range, setRange] = useState("30d")
    const [data, setData] = useState<AiAnalyticsPayload | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let cancelled = false
        setLoading(true)
        setError(null)
        ;(async () => {
            try {
                const res = await fetch(`/api/dashboard/ai-analytics?range=${encodeURIComponent(range)}`)
                const json = await res.json().catch(() => null)
                if (!res.ok) throw new Error(json?.message || "Failed to load analytics")
                if (!cancelled) setData(json)
            } catch (e) {
                if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load analytics")
            } finally {
                if (!cancelled) setLoading(false)
            }
        })()
        return () => {
            cancelled = true
        }
    }, [range])

    const chartMuted = isLight ? "#64748b" : "#94a3b8"
    const gridStroke = isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.08)"
    const tt = useMemo(() => chartTooltipProps(isLight), [isLight])
    const timeline = data?.timeline ?? []
    const sentimentBars = useMemo(() => {
        const totals = data?.customerExperience.sentimentMix.totals
        if (!totals) return []
        return [
            { name: "Positive", count: totals.positive, fill: SENTIMENT_COLORS.positive },
            { name: "Neutral", count: totals.neutral, fill: SENTIMENT_COLORS.neutral },
            { name: "Negative", count: totals.negative, fill: SENTIMENT_COLORS.negative },
            { name: "Urgent", count: totals.urgent, fill: SENTIMENT_COLORS.urgent },
        ]
    }, [data?.customerExperience.sentimentMix.totals])

    return (
        <div className="w-full max-w-none space-y-5 md:space-y-7">
            <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Sparkles className={cn("w-7 h-7", isLight ? "text-indigo-600" : "text-indigo-400")} />
                        <h1 className={cn("text-2xl md:text-3xl font-extrabold tracking-tight", isLight ? "text-slate-900" : "text-white")}>
                            AI Business Analytics
                        </h1>
                    </div>
                    <p className={cn("text-sm md:text-base max-w-3xl", isLight ? "text-slate-500" : "text-slate-400")}>
                        Outcome metrics for revenue, customer experience, automation, and demand signals from AI-assisted storefront journeys.
                    </p>
                </div>
                <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
                    {RANGE_OPTIONS.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => setRange(option.value)}
                            className={cn(
                                "shrink-0 rounded-xl border px-3 py-2 text-xs font-black transition",
                                range === option.value
                                    ? isLight
                                        ? "bg-indigo-600 border-indigo-600 text-white"
                                        : "bg-indigo-500 border-indigo-400 text-white"
                                    : isLight
                                      ? "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                                      : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10",
                            )}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            </div>

            {loading && (
                <div className="flex justify-center py-24">
                    <Loader2 className="w-10 h-10 animate-spin text-indigo-400" />
                </div>
            )}

            {error && (
                <div className={cn("rounded-2xl border p-6 text-sm font-medium", isLight ? "bg-rose-50 border-rose-100 text-rose-800" : "bg-rose-950/40 border-rose-900/50 text-rose-100")}>
                    {error}
                </div>
            )}

            {!loading && data && (
                <>
                    <section className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-4 gap-3 md:gap-4">
                        <MetricCard
                            title="Direct AI upsell revenue"
                            value={formatMoney(data.revenueImpact.directUpsellRevenue, data.revenueImpact.currency)}
                            helper="Only counts AI-suggested products later found in matching Shopify orders."
                            accent={isLight ? "text-emerald-700" : "text-emerald-400"}
                            isLight={isLight}
                        />
                        <MetricCard
                            title="AI-assisted revenue"
                            value={formatMoney(data.revenueImpact.aiAssistedRevenue, data.revenueImpact.currency)}
                            helper="Full order revenue after prior AI engagement in the same customer/order window."
                            accent={isLight ? "text-indigo-700" : "text-indigo-300"}
                            isLight={isLight}
                        />
                        <MetricCard
                            title="Unresolved questions"
                            value={data.customerExperience.unresolvedQuestions.toLocaleString()}
                            helper={`${formatPercent(data.customerExperience.unresolvedQuestionRate)} unresolved rate across customer questions.`}
                            accent={isLight ? "text-orange-700" : "text-orange-300"}
                            isLight={isLight}
                        />
                        <MetricCard
                            title="Hours saved estimate"
                            value={`${data.automationOutcomes.hoursSavedEstimate.toLocaleString()}h`}
                            helper="Estimated from AI answer volume and median manual response time where samples exist."
                            accent={isLight ? "text-sky-700" : "text-sky-300"}
                            isLight={isLight}
                        />
                    </section>

                    <section className="grid grid-cols-1 2xl:grid-cols-3 gap-4 md:gap-5">
                        <div className={cn("2xl:col-span-2 rounded-2xl border p-4 md:p-5", isLight ? "bg-white border-slate-100 shadow-sm" : "bg-white/5 border-white/10")}>
                            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2 mb-5">
                                <div>
                                    <h2 className={cn("text-lg font-black", isLight ? "text-slate-900" : "text-white")}>Revenue Impact Timeline</h2>
                                    <p className={cn("text-xs mt-1", isLight ? "text-slate-500" : "text-slate-400")}>{data.revenueImpact.methodology}</p>
                                </div>
                                <span className={cn("text-[11px] font-black rounded-lg px-2 py-1", isLight ? "bg-slate-100 text-slate-600" : "bg-white/10 text-slate-300")}>
                                    {data.grain} view
                                </span>
                            </div>
                            {timeline.length === 0 ? (
                                <EmptyState isLight={isLight}>Not enough data yet to draw a revenue timeline.</EmptyState>
                            ) : (
                                <div className="w-full overflow-x-auto">
                                    <div className="h-[260px] min-w-[620px] md:h-[300px] md:min-w-0">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={timeline} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                                            <XAxis dataKey="label" tick={{ fill: chartMuted, fontSize: 11, fontWeight: 600 }} axisLine={false} tickLine={false} dy={8} />
                                            <YAxis tick={{ fill: chartMuted, fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} />
                                            <Tooltip {...tt} formatter={(value, name) => [formatMoney(Number(value ?? 0), data.revenueImpact.currency), String(name)]} />
                                            <Legend wrapperStyle={{ fontSize: 11, fontWeight: 700, color: chartMuted }} />
                                            <Area type="monotone" dataKey="aiAssistedRevenue" name="AI-assisted" stackId="1" stroke="#6366f1" fill="#6366f1" fillOpacity={0.22} />
                                            <Area type="monotone" dataKey="directUpsellRevenue" name="Direct upsell" stackId="1" stroke="#22c55e" fill="#22c55e" fillOpacity={0.35} />
                                            <Area type="monotone" dataKey="directCrossSellRevenue" name="Direct cross-sell" stackId="1" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.3} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className={cn("rounded-2xl border p-4 md:p-5", isLight ? "bg-white border-slate-100 shadow-sm" : "bg-white/5 border-white/10")}>
                            <h2 className={cn("text-lg font-black", isLight ? "text-slate-900" : "text-white")}>Customer Sentiment</h2>
                            <p className={cn("text-xs mt-1 mb-5", isLight ? "text-slate-500" : "text-slate-400")}>
                                Conservative sentiment from storefront customer messages. Unknown is kept out of the chart.
                            </p>
                            {sentimentBars.every((row) => row.count === 0) ? (
                                <EmptyState isLight={isLight}>Not enough sentiment data yet.</EmptyState>
                            ) : (
                                <div className="h-[220px] w-full min-w-0 sm:h-[240px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={sentimentBars} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                                            <XAxis dataKey="name" tick={{ fill: chartMuted, fontSize: 11, fontWeight: 600 }} axisLine={false} tickLine={false} dy={8} />
                                            <YAxis tick={{ fill: chartMuted, fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} />
                                            <Tooltip {...tt} />
                                            <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                                                {sentimentBars.map((row) => (
                                                    <Cell key={row.name} fill={row.fill} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </div>
                    </section>

                    <section className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-5">
                        <div className={cn("rounded-2xl border p-4 md:p-5", isLight ? "bg-white border-slate-100 shadow-sm" : "bg-white/5 border-white/10")}>
                            <h2 className={cn("text-lg font-black", isLight ? "text-slate-900" : "text-white")}>Automation Outcomes</h2>
                            <p className={cn("text-xs mt-1 mb-5", isLight ? "text-slate-500" : "text-slate-400")}>
                                Shows the operational outcomes owners care about: handled questions, AI resolution, tickets, and response speed.
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <MetricCard title="Questions handled" value={data.automationOutcomes.questionsAnswered.toLocaleString()} helper="Customer questions in the selected window." accent={isLight ? "text-slate-900" : "text-white"} isLight={isLight} />
                                <MetricCard title="Resolved by AI" value={formatPercent(data.automationOutcomes.resolutionRate)} helper={`${data.automationOutcomes.resolvedByAi.toLocaleString()} resolved events.`} accent={isLight ? "text-emerald-700" : "text-emerald-400"} isLight={isLight} />
                                <MetricCard title="Tickets created" value={data.automationOutcomes.ticketsCreated.toLocaleString()} helper="Escalations sent to human support." accent={isLight ? "text-rose-700" : "text-rose-300"} isLight={isLight} />
                                <MetricCard title="AI response median" value={`${data.automationOutcomes.aiMedianSeconds}s`} helper={`Manual median: ${data.automationOutcomes.manualMedianMinutes.toFixed(1)} min.`} accent={isLight ? "text-sky-700" : "text-sky-300"} isLight={isLight} />
                            </div>
                        </div>

                        <div className={cn("rounded-2xl border p-4 md:p-5", isLight ? "bg-white border-slate-100 shadow-sm" : "bg-white/5 border-white/10")}>
                            <h2 className={cn("text-lg font-black", isLight ? "text-slate-900" : "text-white")}>Questions And Resolutions</h2>
                            <p className={cn("text-xs mt-1 mb-5", isLight ? "text-slate-500" : "text-slate-400")}>
                                Timeline of demand, AI resolution, unresolved questions, and support tickets.
                            </p>
                            <div className="w-full overflow-x-auto">
                                <div className="h-[240px] min-w-[620px] md:h-[260px] md:min-w-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={timeline} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                                        <XAxis dataKey="label" tick={{ fill: chartMuted, fontSize: 11, fontWeight: 600 }} axisLine={false} tickLine={false} dy={8} />
                                        <YAxis tick={{ fill: chartMuted, fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} />
                                        <Tooltip {...tt} />
                                        <Legend wrapperStyle={{ fontSize: 11, fontWeight: 700, color: chartMuted }} />
                                        <Line type="monotone" dataKey="questions" name="Questions" stroke="#6366f1" strokeWidth={2} dot={false} />
                                        <Line type="monotone" dataKey="resolvedByAi" name="Resolved" stroke="#22c55e" strokeWidth={2} dot={false} />
                                        <Line type="monotone" dataKey="unresolvedQuestions" name="Unresolved" stroke="#f97316" strokeWidth={2} dot={false} />
                                        <Line type="monotone" dataKey="ticketsCreated" name="Tickets" stroke="#ef4444" strokeWidth={2} dot={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-5">
                        <div className={cn("rounded-2xl border p-4 md:p-5", isLight ? "bg-white border-slate-100 shadow-sm" : "bg-white/5 border-white/10")}>
                            <h2 className={cn("text-lg font-black", isLight ? "text-slate-900" : "text-white")}>Growth Signals</h2>
                            <p className={cn("text-xs mt-1 mb-4", isLight ? "text-slate-500" : "text-slate-400")}>
                                Product curiosity and repeated requests that can guide buying, merchandising, and product-page content.
                            </p>
                            {data.demandSignals.topProductQuestions.length === 0 ? (
                                <EmptyState isLight={isLight}>Not enough product-question data yet.</EmptyState>
                            ) : (
                                <div className="max-h-[294px] space-y-2 overflow-y-auto pr-1 custom-scrollbar">
                                    {data.demandSignals.topProductQuestions.map((row) => (
                                        <div key={row.name} className={cn("flex items-center justify-between gap-3 rounded-xl border px-3 py-2", isLight ? "bg-slate-50 border-slate-100" : "bg-white/[0.04] border-white/10")}>
                                            <span className={cn("text-sm font-bold truncate", isLight ? "text-slate-800" : "text-slate-200")}>{row.name}</span>
                                            <span className={cn("text-xs font-black rounded-lg px-2 py-1", isLight ? "bg-indigo-100 text-indigo-700" : "bg-indigo-500/20 text-indigo-200")}>{row.count}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className={cn("rounded-2xl border p-4 md:p-5", isLight ? "bg-white border-slate-100 shadow-sm" : "bg-white/5 border-white/10")}>
                            <h2 className={cn("text-lg font-black", isLight ? "text-slate-900" : "text-white")}>Attribution Health</h2>
                            <p className={cn("text-xs mt-1 mb-4", isLight ? "text-slate-500" : "text-slate-400")}>
                                Conservative matching keeps revenue accurate. Pending attribution means cart interest exists but no matching order has been cached yet.
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <MetricCard title="Cart conversion" value={formatPercent(data.revenueImpact.aiCartConversionRate)} helper="Orders matched to AI cart actions." accent={isLight ? "text-emerald-700" : "text-emerald-400"} isLight={isLight} />
                                <MetricCard title="Pending attribution" value={data.revenueImpact.pendingAttributionCount.toLocaleString()} helper="Clicks awaiting a matching Shopify order." accent={isLight ? "text-amber-700" : "text-amber-300"} isLight={isLight} />
                                <MetricCard title="Cross-sell revenue" value={formatMoney(data.revenueImpact.directCrossSellRevenue, data.revenueImpact.currency)} helper="Shown separately from upsell revenue." accent={isLight ? "text-cyan-700" : "text-cyan-300"} isLight={isLight} />
                                <MetricCard title="Avg influenced order" value={formatMoney(data.revenueImpact.averageAiInfluencedOrderValue, data.revenueImpact.currency)} helper="Average value for AI-assisted orders." accent={isLight ? "text-indigo-700" : "text-indigo-300"} isLight={isLight} />
                            </div>
                        </div>
                    </section>

                    <details className={cn("rounded-2xl border p-4 md:p-5", isLight ? "bg-white border-slate-100 shadow-sm" : "bg-white/5 border-white/10")}>
                        <summary className={cn("cursor-pointer text-sm font-black", isLight ? "text-slate-800" : "text-slate-200")}>
                            Technical Diagnostics
                        </summary>
                        <div className={cn("grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 text-sm", isLight ? "text-slate-600" : "text-slate-300")}>
                            <p>AI messages: {data.technicalDiagnostics.storefrontAiMessages}</p>
                            <p>Customer messages: {data.technicalDiagnostics.storefrontCustomerMessages}</p>
                            <p>Analytics events: {data.technicalDiagnostics.analyticsEvents}</p>
                            <p>Cached orders: {data.technicalDiagnostics.cachedOrders}</p>
                        </div>
                    </details>
                </>
            )}
        </div>
    )
}
