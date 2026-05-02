"use client"

import { useEffect, useMemo, useState } from "react"
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    Legend,
    Line,
    LineChart,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
    Cell,
} from "recharts"
import { Loader2, Sparkles } from "lucide-react"
import { useTheme } from "@/components/ThemeProvider"
import { cn } from "@/lib/utils"

type ModelEvaluationPayload = {
    modelName: string
    pipelineVersion: string
    evaluationWindow: string
    sampleSize: number
    accuracyPct: number
    precisionPct: number
    recallPct: number
    f1Pct: number
    confusionMatrix: {
        truePositive: number
        falsePositive: number
        falseNegative: number
        trueNegative: number
    }
    monthlyF1Pct: { month: string; f1: number }[]
}

type AiAnalyticsPayload = {
    modelEvaluation: ModelEvaluationPayload
    automationSeries: {
        month: string
        storefrontAiSharePct: number
        gmailAutoReplies: number
        volumes: { aiMessages: number; customerMessages: number }
    }[]
    messageVolumeByType: { name: string; count: number }[]
    responseTime: {
        aiMedianSeconds: number
        manualMedianMinutes: number
        sampleAiPairs: number
        sampleManualPairs: number
        byMonth: { month: string; aiMinutes: number; manualMinutes: number }[]
    }
    attributedSupportSales: {
        totalAmount: number
        currency: string
        rows: {
            id: string
            initials: string
            label: string
            summary: string
            amount: number | null
            currency: string
            channel: "AI"
            updatedAt: string
        }[]
    }
    totals: {
        storefrontAiMessages: number
        storefrontCustomerMessages: number
        gmailAutoReplies: number
    }
}

const INTENT_COLORS: Record<string, string> = {
    WISMO: "#3b82f6",
    Returns: "#f97316",
    "Product Qs": "#a855f7",
    Shipping: "#22c55e",
    General: "#94a3b8",
}

function formatMoney(amount: number, currency: string) {
    try {
        return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount)
    } catch {
        return `${currency} ${amount.toFixed(2)}`
    }
}

export default function AiAnalyticsPage() {
    const { theme } = useTheme()
    const isLight = theme === "light"
    const [data, setData] = useState<AiAnalyticsPayload | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let cancelled = false
        ;(async () => {
            try {
                const res = await fetch("/api/dashboard/ai-analytics")
                const json = await res.json().catch(() => null)
                if (!res.ok) throw new Error(json?.message || "Failed to load analytics")
                if (!cancelled) setData(json)
            } catch (e) {
                if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load")
            } finally {
                if (!cancelled) setLoading(false)
            }
        })()
        return () => {
            cancelled = true
        }
    }, [])

    const chartMuted = isLight ? "#64748b" : "#94a3b8"
    const gridStroke = isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.08)"
    const tooltipBg = isLight ? "#ffffff" : "#0f172a"
    const tooltipBorder = isLight ? "#e2e8f0" : "rgba(255,255,255,0.12)"

    const barData = useMemo(
        () =>
            (data?.messageVolumeByType ?? []).map((r) => ({
                ...r,
                fill: INTENT_COLORS[r.name] ?? "#6366f1",
            })),
        [data?.messageVolumeByType],
    )

    const responseBars = useMemo(() => {
        const rows = data?.responseTime.byMonth ?? []
        return rows.map((r) => ({
            month: r.month,
            AI: r.aiMinutes > 0 ? r.aiMinutes : 0,
            Manual: r.manualMinutes > 0 ? r.manualMinutes : 0,
        }))
    }, [data?.responseTime.byMonth])

    return (
        <div className="space-y-6 md:space-y-8 max-w-[1400px] mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Sparkles className={cn("w-7 h-7", isLight ? "text-indigo-600" : "text-indigo-400")} />
                        <h1
                            className={cn(
                                "text-2xl md:text-3xl font-extrabold tracking-tight",
                                isLight ? "text-slate-900" : "text-white",
                            )}
                        >
                            AI Analytics
                        </h1>
                    </div>
                    <p className={cn("text-sm md:text-base max-w-2xl", isLight ? "text-slate-500" : "text-slate-400")}>
                        Live metrics from storefront AI replies, Gmail automation, JUNO Chat response times, and
                        storefront sessions linked to Shopify orders.
                    </p>
                </div>
                {data && (
                    <div
                        className={cn(
                            "text-xs font-semibold rounded-xl px-4 py-2 border",
                            isLight ? "bg-white border-slate-200 text-slate-600" : "bg-white/5 border-white/10 text-slate-300",
                        )}
                    >
                        <span className="opacity-70">Last 6 months · AI msgs </span>
                        <span className="text-emerald-500">{data.totals.storefrontAiMessages}</span>
                        <span className="opacity-70"> · Gmail auto </span>
                        <span className="text-sky-400">{data.totals.gmailAutoReplies}</span>
                    </div>
                )}
            </div>

            {loading && (
                <div className="flex justify-center py-24">
                    <Loader2 className="w-10 h-10 animate-spin text-indigo-400" />
                </div>
            )}
            {error && (
                <div
                    className={cn(
                        "rounded-2xl border p-6 text-sm font-medium",
                        isLight ? "bg-rose-50 border-rose-100 text-rose-800" : "bg-rose-950/40 border-rose-900/50 text-rose-100",
                    )}
                >
                    {error}
                </div>
            )}

            {!loading && data && (
                <>
                    <div
                        className={cn(
                            "p-4 md:p-6 rounded-xl md:rounded-2xl border",
                            isLight ? "bg-white border-slate-100 shadow-sm" : "bg-white/5 border-white/10 backdrop-blur-xl",
                        )}
                    >
                        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-6">
                            <div>
                                <h3 className={cn("text-lg font-bold", isLight ? "text-slate-900" : "text-white")}>
                                    Model performance
                                </h3>
                                <p className={cn("text-xs mt-1 max-w-xl", isLight ? "text-slate-500" : "text-slate-400")}>
                                    Intent routing and reply-quality classification tracked against assistant-handled
                                    conversations on your storefront and Gmail automation pipeline.
                                </p>
                            </div>
                            <div
                                className={cn(
                                    "text-[11px] font-semibold space-y-1 rounded-xl px-4 py-3 border shrink-0",
                                    isLight ? "bg-slate-50 border-slate-100 text-slate-600" : "bg-white/[0.06] border-white/10 text-slate-300",
                                )}
                            >
                                <p>
                                    <span className={cn("opacity-70 font-bold uppercase tracking-wide", isLight ? "" : "")}>Model </span>
                                    <span className={isLight ? "text-slate-900" : "text-white"}>{data.modelEvaluation.modelName}</span>
                                </p>
                                <p>
                                    <span className="opacity-70 font-bold uppercase tracking-wide">Release </span>
                                    <span className={isLight ? "text-slate-900" : "text-white"}>{data.modelEvaluation.pipelineVersion}</span>
                                </p>
                                <p className="opacity-80">{data.modelEvaluation.evaluationWindow}</p>
                                <p>
                                    <span className="opacity-70">Weighted eval samples </span>
                                    <span className={isLight ? "text-indigo-600" : "text-indigo-300"}>
                                        {data.modelEvaluation.sampleSize.toLocaleString()}
                                    </span>
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
                            {(
                                [
                                    { label: "Accuracy", value: data.modelEvaluation.accuracyPct, accent: "text-emerald-500" },
                                    { label: "Precision", value: data.modelEvaluation.precisionPct, accent: "text-sky-500" },
                                    { label: "Recall", value: data.modelEvaluation.recallPct, accent: "text-violet-500" },
                                    { label: "F1 score", value: data.modelEvaluation.f1Pct, accent: "text-indigo-500" },
                                ] as const
                            ).map((m) => (
                                <div
                                    key={m.label}
                                    className={cn(
                                        "rounded-xl border p-4",
                                        isLight ? "bg-slate-50/90 border-slate-100" : "bg-white/[0.04] border-white/10",
                                    )}
                                >
                                    <p className={cn("text-[10px] uppercase font-bold tracking-widest", isLight ? "text-slate-500" : "text-slate-400")}>
                                        {m.label}
                                    </p>
                                    <p className={cn("text-2xl md:text-3xl font-black mt-1 tabular-nums", isLight ? "text-slate-900" : "text-white")}>
                                        {m.value}
                                        <span className={cn("text-lg align-top ml-0.5", m.accent)}>%</span>
                                    </p>
                                </div>
                            ))}
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="min-h-[220px]">
                                <h4 className={cn("text-sm font-bold mb-3", isLight ? "text-slate-800" : "text-slate-200")}>
                                    F1 score trend
                                </h4>
                                <div className="h-[200px] w-full min-w-0">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={data.modelEvaluation.monthlyF1Pct} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                                            <XAxis
                                                dataKey="month"
                                                tick={{ fill: chartMuted, fontSize: 11, fontWeight: 600 }}
                                                axisLine={false}
                                                tickLine={false}
                                                dy={8}
                                            />
                                            <YAxis
                                                domain={[78, 99]}
                                                tick={{ fill: chartMuted, fontSize: 10, fontWeight: 600 }}
                                                axisLine={false}
                                                tickLine={false}
                                                tickFormatter={(v) => `${v}%`}
                                            />
                                            <Tooltip
                                                contentStyle={{
                                                    borderRadius: 12,
                                                    border: `1px solid ${tooltipBorder}`,
                                                    background: tooltipBg,
                                                    fontWeight: 600,
                                                }}
                                                formatter={(v) => [`${Number(v ?? 0)}%`, "F1"]}
                                            />
                                            <Line type="monotone" dataKey="f1" stroke="#6366f1" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            <div>
                                <h4 className={cn("text-sm font-bold mb-3", isLight ? "text-slate-800" : "text-slate-200")}>
                                    Confusion matrix (held-out)
                                </h4>
                                <div className="flex justify-end gap-3 text-[10px] font-bold uppercase tracking-wide mb-2 pr-1">
                                    <span className={cn("w-[calc(50%-6px)] text-center", isLight ? "text-slate-500" : "text-slate-400")}>
                                        Predicted relevant
                                    </span>
                                    <span className={cn("w-[calc(50%-6px)] text-center", isLight ? "text-slate-500" : "text-slate-400")}>
                                        Predicted not relevant
                                    </span>
                                </div>
                                <div className="flex gap-3">
                                    <div
                                        className={cn(
                                            "flex flex-col justify-center gap-10 py-2 w-24 shrink-0 text-[10px] font-bold uppercase tracking-wide leading-tight",
                                            isLight ? "text-slate-500" : "text-slate-400",
                                        )}
                                    >
                                        <span>Actual relevant</span>
                                        <span>Actual not relevant</span>
                                    </div>
                                    <div className="flex-1 grid grid-cols-2 gap-3">
                                        <div
                                            className={cn(
                                                "rounded-xl border p-4 text-center",
                                                isLight ? "bg-emerald-50 border-emerald-100 text-emerald-900" : "bg-emerald-500/10 border-emerald-500/25 text-emerald-100",
                                            )}
                                        >
                                            <p className="text-[10px] uppercase opacity-80 mb-1">True positive</p>
                                            <p className="text-2xl font-black tabular-nums">{data.modelEvaluation.confusionMatrix.truePositive}</p>
                                        </div>
                                        <div
                                            className={cn(
                                                "rounded-xl border p-4 text-center",
                                                isLight ? "bg-amber-50 border-amber-100 text-amber-950" : "bg-amber-500/10 border-amber-500/25 text-amber-100",
                                            )}
                                        >
                                            <p className="text-[10px] uppercase opacity-80 mb-1">False negative</p>
                                            <p className="text-2xl font-black tabular-nums">{data.modelEvaluation.confusionMatrix.falseNegative}</p>
                                        </div>
                                        <div
                                            className={cn(
                                                "rounded-xl border p-4 text-center",
                                                isLight ? "bg-rose-50 border-rose-100 text-rose-950" : "bg-rose-500/10 border-rose-500/25 text-rose-100",
                                            )}
                                        >
                                            <p className="text-[10px] uppercase opacity-80 mb-1">False positive</p>
                                            <p className="text-2xl font-black tabular-nums">{data.modelEvaluation.confusionMatrix.falsePositive}</p>
                                        </div>
                                        <div
                                            className={cn(
                                                "rounded-xl border p-4 text-center",
                                                isLight ? "bg-slate-50 border-slate-200 text-slate-800" : "bg-white/[0.06] border-white/10 text-slate-200",
                                            )}
                                        >
                                            <p className="text-[10px] uppercase opacity-80 mb-1">True negative</p>
                                            <p className="text-2xl font-black tabular-nums">{data.modelEvaluation.confusionMatrix.trueNegative}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                        <div
                            className={cn(
                                "p-4 md:p-6 rounded-xl md:rounded-2xl border min-h-[320px]",
                                isLight ? "bg-white border-slate-100 shadow-sm" : "bg-white/5 border-white/10 backdrop-blur-xl",
                            )}
                        >
                            <h3 className={cn("text-lg font-bold", isLight ? "text-slate-900" : "text-white")}>
                                AI share of storefront traffic
                            </h3>
                            <p className={cn("text-xs mt-1 mb-4", isLight ? "text-slate-500" : "text-slate-400")}>
                                AI messages ÷ (AI + customer messages) per month. Gmail auto-replies shown in tooltip.
                            </p>
                            <div className="h-[240px] w-full min-w-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={data.automationSeries} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="aiShareFill" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#22c55e" stopOpacity={isLight ? 0.35 : 0.25} />
                                                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                                        <XAxis
                                            dataKey="month"
                                            tick={{ fill: chartMuted, fontSize: 11, fontWeight: 600 }}
                                            axisLine={false}
                                            tickLine={false}
                                            dy={8}
                                        />
                                        <YAxis
                                            tickFormatter={(v) => `${v}%`}
                                            domain={[0, 100]}
                                            tick={{ fill: chartMuted, fontSize: 10, fontWeight: 600 }}
                                            axisLine={false}
                                            tickLine={false}
                                        />
                                        <Tooltip
                                            contentStyle={{
                                                borderRadius: 12,
                                                border: `1px solid ${tooltipBorder}`,
                                                background: tooltipBg,
                                                fontWeight: 600,
                                            }}
                                            formatter={(value, _name, item) => {
                                                const g = (item as { payload?: { gmailAutoReplies?: number } })?.payload
                                                    ?.gmailAutoReplies
                                                return [`${Number(value ?? 0)}% (Gmail auto: ${g ?? 0})`, "AI share"]
                                            }}
                                            labelFormatter={(l) => String(l)}
                                        />
                                        <ReferenceLine
                                            y={80}
                                            stroke={isLight ? "#cbd5e1" : "rgba(148,163,184,0.5)"}
                                            strokeDasharray="4 4"
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="storefrontAiSharePct"
                                            stroke="#16a34a"
                                            strokeWidth={2}
                                            fillOpacity={1}
                                            fill="url(#aiShareFill)"
                                            name="storefrontAiSharePct"
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div
                            className={cn(
                                "p-4 md:p-6 rounded-xl md:rounded-2xl border min-h-[320px]",
                                isLight ? "bg-white border-slate-100 shadow-sm" : "bg-white/5 border-white/10 backdrop-blur-xl",
                            )}
                        >
                            <h3 className={cn("text-lg font-bold", isLight ? "text-slate-900" : "text-white")}>
                                Customer topics (storefront)
                            </h3>
                            <p className={cn("text-xs mt-1 mb-4", isLight ? "text-slate-500" : "text-slate-400")}>
                                Classified from customer messages via keyword rules (WISMO, returns, products, shipping).
                            </p>
                            <div className="h-[240px] w-full min-w-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart layout="vertical" data={barData} margin={{ left: 4, right: 16, top: 4, bottom: 4 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal stroke={gridStroke} />
                                        <XAxis type="number" tick={{ fill: chartMuted, fontSize: 10 }} axisLine={false} tickLine={false} />
                                        <YAxis
                                            type="category"
                                            dataKey="name"
                                            width={88}
                                            tick={{ fill: chartMuted, fontSize: 11, fontWeight: 600 }}
                                            axisLine={false}
                                            tickLine={false}
                                        />
                                        <Tooltip
                                            cursor={{ fill: isLight ? "rgba(99,102,241,0.06)" : "rgba(255,255,255,0.05)" }}
                                            contentStyle={{
                                                borderRadius: 12,
                                                border: `1px solid ${tooltipBorder}`,
                                                background: tooltipBg,
                                                fontWeight: 600,
                                            }}
                                        />
                                        <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={18}>
                                            {barData.map((entry, i) => (
                                                <Cell key={i} fill={entry.fill} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div
                            className={cn(
                                "p-4 md:p-6 rounded-xl md:rounded-2xl border min-h-[320px]",
                                isLight ? "bg-white border-slate-100 shadow-sm" : "bg-white/5 border-white/10 backdrop-blur-xl",
                            )}
                        >
                            <h3 className={cn("text-lg font-bold", isLight ? "text-slate-900" : "text-white")}>
                                Response time: AI vs manual
                            </h3>
                            <p className={cn("text-xs mt-1 mb-4", isLight ? "text-slate-500" : "text-slate-400")}>
                                AI = median seconds from customer message to AI reply (storefront). Manual = median
                                minutes from inbound supplier message to your reply (JUNO Chat), when sample exists.
                            </p>
                            <div className="h-[240px] w-full min-w-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={responseBars} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                                        <XAxis
                                            dataKey="month"
                                            tick={{ fill: chartMuted, fontSize: 11, fontWeight: 600 }}
                                            axisLine={false}
                                            tickLine={false}
                                            dy={8}
                                        />
                                        <YAxis
                                            tick={{ fill: chartMuted, fontSize: 10, fontWeight: 600 }}
                                            axisLine={false}
                                            tickLine={false}
                                            tickFormatter={(v) => `${v}m`}
                                        />
                                        <Legend wrapperStyle={{ fontSize: 11, fontWeight: 600 }} />
                                        <Tooltip
                                            contentStyle={{
                                                borderRadius: 12,
                                                border: `1px solid ${tooltipBorder}`,
                                                background: tooltipBg,
                                                fontWeight: 600,
                                            }}
                                            formatter={(value, name) =>
                                                name === "AI"
                                                    ? [`${Number(value ?? 0)} min (median)`, "AI"]
                                                    : [`${Number(value ?? 0)} min (median)`, "Manual"]
                                            }
                                        />
                                        <Bar dataKey="AI" fill="#22c55e" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="Manual" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                            <p className={cn("text-[10px] mt-2 font-medium", isLight ? "text-slate-400" : "text-slate-500")}>
                                Samples: AI pairs {data.responseTime.sampleAiPairs} · Manual pairs{" "}
                                {data.responseTime.sampleManualPairs}. Overall medians: AI{" "}
                                {(data.responseTime.aiMedianSeconds / 60).toFixed(1)} min · Manual{" "}
                                {data.responseTime.manualMedianMinutes.toFixed(1)} min
                            </p>
                        </div>

                        <div
                            className={cn(
                                "p-4 md:p-6 rounded-xl md:rounded-2xl border min-h-[320px] flex flex-col",
                                isLight ? "bg-white border-slate-100 shadow-sm" : "bg-white/5 border-white/10 backdrop-blur-xl",
                            )}
                        >
                            <h3 className={cn("text-lg font-bold", isLight ? "text-slate-900" : "text-white")}>
                                Revenue linked after AI storefront sessions
                            </h3>
                            <p className={cn("text-xs mt-1 mb-4", isLight ? "text-slate-500" : "text-slate-400")}>
                                Orders pinned during verified storefront chat (last ~30 days). Totals use cached Shopify
                                orders for your active store.
                            </p>
                            <div className="flex-1 overflow-y-auto space-y-2 min-h-[180px] max-h-[260px] pr-1 custom-scrollbar">
                                {data.attributedSupportSales.rows.length === 0 ? (
                                    <p className={cn("text-sm italic py-8 text-center", isLight ? "text-slate-400" : "text-slate-500")}>
                                        No bound orders yet — when customers verify and attach an order in chat,
                                        conversions appear here.
                                    </p>
                                ) : (
                                    data.attributedSupportSales.rows.map((row) => (
                                        <div
                                            key={row.id}
                                            className={cn(
                                                "flex items-center gap-3 p-3 rounded-xl border",
                                                isLight ? "border-slate-100 bg-slate-50/80" : "border-white/10 bg-white/[0.04]",
                                            )}
                                        >
                                            <div
                                                className={cn(
                                                    "w-10 h-10 rounded-full flex items-center justify-center text-xs font-black shrink-0",
                                                    isLight ? "bg-indigo-100 text-indigo-700" : "bg-indigo-500/20 text-indigo-200",
                                                )}
                                            >
                                                {row.initials}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className={cn("text-sm font-bold truncate", isLight ? "text-slate-900" : "text-white")}>
                                                    {row.label}
                                                </p>
                                                <p className={cn("text-xs truncate", isLight ? "text-slate-500" : "text-slate-400")}>
                                                    {row.summary}
                                                </p>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <p className={cn("text-sm font-black", isLight ? "text-emerald-700" : "text-emerald-400")}>
                                                    {row.amount != null
                                                        ? formatMoney(row.amount, row.currency || data.attributedSupportSales.currency)
                                                        : "—"}
                                                </p>
                                                <span
                                                    className={cn(
                                                        "text-[10px] font-bold uppercase px-2 py-0.5 rounded-md inline-block mt-1",
                                                        "bg-emerald-500/15 text-emerald-500",
                                                    )}
                                                >
                                                    AI session
                                                </span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                            <div
                                className={cn(
                                    "mt-4 pt-4 border-t flex justify-between items-center",
                                    isLight ? "border-slate-100" : "border-white/10",
                                )}
                            >
                                <span className={cn("text-xs font-bold uppercase tracking-wide", isLight ? "text-slate-500" : "text-slate-400")}>
                                    Total attributed (window)
                                </span>
                                <span className={cn("text-lg font-black", isLight ? "text-emerald-600" : "text-emerald-400")}>
                                    {formatMoney(
                                        data.attributedSupportSales.totalAmount,
                                        data.attributedSupportSales.currency,
                                    )}
                                </span>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
