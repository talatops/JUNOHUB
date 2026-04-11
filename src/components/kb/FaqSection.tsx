"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useTheme } from "@/components/ThemeProvider"
import { cn } from "@/lib/utils"

type FaqItem = {
    id: string
    question: string
    answer: string
    tags?: unknown
    createdAt: string
}

type FaqSectionProps = {
    storeId: string
    locked?: boolean
    lockedMessage?: string
    settingsHref?: string
}

export function FaqSection({
    storeId,
    locked = false,
    lockedMessage = "Manual FAQs are disabled while using structured knowledge. Switch mode using the cards above.",
    settingsHref = "/dashboard/juno-engine/knowledge-base#kb-source",
}: FaqSectionProps) {
    const { theme } = useTheme()
    const isLight = theme === "light"
    const [faqs, setFaqs] = useState<FaqItem[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [question, setQuestion] = useState("")
    const [answer, setAnswer] = useState("")
    const [isSaving, setIsSaving] = useState(false)
    const [isImporting, setIsImporting] = useState(false)

    useEffect(() => {
        if (!storeId) return
            ; (async () => {
                try {
                    setIsLoading(true)
                    setError(null)
                    const res = await fetch(
                        `/api/stores/${encodeURIComponent(storeId)}/kb/faqs`,
                    )
                    if (!res.ok) {
                        throw new Error("Failed to load FAQs")
                    }
                    const json = (await res.json()) as { faqs: FaqItem[] }
                    setFaqs(json.faqs)
                } catch (err) {
                    setError(
                        err instanceof Error
                            ? err.message
                            : "Failed to load FAQs",
                    )
                } finally {
                    setIsLoading(false)
                }
            })()
    }, [storeId])

    async function handleAddFaq(e: React.FormEvent) {
        e.preventDefault()
        if (!question.trim() || !answer.trim()) return

        try {
            setIsSaving(true)
            setError(null)
            const res = await fetch(
                `/api/stores/${encodeURIComponent(storeId)}/kb/faqs`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        question: question.trim(),
                        answer: answer.trim(),
                    }),
                },
            )
            if (!res.ok) {
                const json = await res.json().catch(() => ({}))
                throw new Error(json.message || "Failed to add FAQ")
            }

            setQuestion("")
            setAnswer("")
            // Refresh FAQs
            if (storeId) {
                try {
                    setIsLoading(true)
                    setError(null)
                    const res = await fetch(
                        `/api/stores/${encodeURIComponent(storeId)}/kb/faqs`,
                    )
                    if (!res.ok) {
                        throw new Error("Failed to load FAQs")
                    }
                    const json = (await res.json()) as { faqs: FaqItem[] }
                    setFaqs(json.faqs)
                } catch (err) {
                    setError(
                        err instanceof Error
                            ? err.message
                            : "Failed to load FAQs",
                    )
                } finally {
                    setIsLoading(false)
                }
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to add FAQ")
        } finally {
            setIsSaving(false)
        }
    }

    async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file) return

        const formData = new FormData()
        formData.append("file", file)

        try {
            setIsImporting(true)
            setError(null)
            const res = await fetch(
                `/api/stores/${encodeURIComponent(storeId)}/kb/faqs/import`,
                {
                    method: "POST",
                    body: formData,
                },
            )

            if (!res.ok) {
                const json = await res.json().catch(() => ({}))
                throw new Error(json.message || "Failed to import FAQs")
            }

            if (storeId) {
                try {
                    setIsLoading(true)
                    setError(null)
                    const res = await fetch(
                        `/api/stores/${encodeURIComponent(storeId)}/kb/faqs`,
                    )
                    if (!res.ok) {
                        throw new Error("Failed to load FAQs")
                    }
                    const json = (await res.json()) as { faqs: FaqItem[] }
                    setFaqs(json.faqs)
                } catch (err) {
                    setError(
                        err instanceof Error
                            ? err.message
                            : "Failed to load FAQs",
                    )
                } finally {
                    setIsLoading(false)
                }
            }
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Failed to import FAQs",
            )
        } finally {
            setIsImporting(false)
            e.target.value = ""
        }
    }

    return (
        <div className="space-y-4">
            {locked && (
                <div
                    className={cn(
                        "rounded-xl border px-4 py-3 text-sm",
                        isLight
                            ? "border-amber-200 bg-amber-50 text-amber-900"
                            : "border-amber-500/30 bg-amber-500/10 text-amber-100",
                    )}
                >
                    <p>{lockedMessage}</p>
                    <Link
                        href={settingsHref}
                        className={cn(
                            "mt-2 inline-block text-xs font-bold underline",
                            isLight ? "text-indigo-600" : "text-indigo-300",
                        )}
                    >
                        Knowledge base
                    </Link>
                </div>
            )}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className={cn("text-lg font-semibold", isLight ? "text-slate-900" : "text-white")}>FAQs</h3>
                    <p className={cn("text-xs", isLight ? "text-slate-500" : "text-slate-400")}>
                        Manage frequently asked questions that your AI can use as
                        trusted answers.
                    </p>
                </div>
                <label
                    className={cn(
                        "inline-flex items-center px-3 py-2 rounded-lg text-xs font-medium transition-colors border shadow-sm",
                        locked
                            ? isLight
                                ? "opacity-50 cursor-not-allowed bg-white border-slate-200 text-slate-400"
                                : "opacity-50 cursor-not-allowed bg-slate-800/80 border-white/10 text-slate-500"
                            : isLight
                              ? "cursor-pointer bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                              : "cursor-pointer bg-slate-800/80 hover:bg-slate-800 border-white/10 text-slate-100 shadow-xl",
                    )}
                >
                    <span>
                        {isImporting ? "Importing..." : "Import from JSON file"}
                    </span>
                    <input
                        type="file"
                        accept="application/json"
                        className="hidden"
                        onChange={handleImport}
                        disabled={isImporting || locked}
                    />
                </label>
            </div>

            {error && (
                <div className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                    {error}
                </div>
            )}

            <form
                onSubmit={handleAddFaq}
                className={cn(
                    "border rounded-xl p-4 space-y-4 transition-all",
                    locked && "opacity-50 pointer-events-none",
                    isLight ? "bg-white border-slate-100 shadow-sm" : "bg-slate-900/40 border-white/5 backdrop-blur-sm"
                )}
            >
                <div className="grid grid-cols-1 gap-4">
                    <div>
                        <label className={cn("block text-[11px] font-bold uppercase tracking-wider mb-1.5", isLight ? "text-slate-500" : "text-slate-400")}>
                            Question
                        </label>
                        <input
                            value={question}
                            onChange={(e) => setQuestion(e.target.value)}
                            placeholder="e.g. What is your return policy?"
                            className={cn(
                                "w-full px-3 py-2 rounded-lg border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50",
                                isLight
                                    ? "bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400"
                                    : "bg-slate-950/60 border-white/10 text-white placeholder:text-slate-500"
                            )}
                        />
                    </div>
                    <div>
                        <label className={cn("block text-[11px] font-bold uppercase tracking-wider mb-1.5", isLight ? "text-slate-500" : "text-slate-400")}>
                            Answer
                        </label>
                        <textarea
                            value={answer}
                            onChange={(e) => setAnswer(e.target.value)}
                            placeholder="Provide a clear, friendly answer that can be shown directly to customers."
                            className={cn(
                                "w-full px-3 py-2 rounded-lg border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 min-h-[100px]",
                                isLight
                                    ? "bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400"
                                    : "bg-slate-950/60 border-white/10 text-white placeholder:text-slate-500"
                            )}
                        />
                    </div>
                </div>
                <div className="flex justify-end pt-2">
                    <button
                        type="submit"
                        disabled={isSaving}
                        className="inline-flex items-center px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-xs font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                    >
                        {isSaving ? "Saving..." : "Add FAQ"}
                    </button>
                </div>
            </form>

            <div className={cn(
                "border rounded-xl transition-all",
                isLight ? "bg-white border-slate-100 shadow-sm" : "bg-slate-900/40 border-white/5 backdrop-blur-sm"
            )}>
                <div className={cn(
                    "px-4 py-3 border-b flex items-center justify-between",
                    isLight ? "border-slate-100" : "border-white/5"
                )}>
                    <span className={cn(
                        "text-xs font-semibold uppercase tracking-wide",
                        isLight ? "text-slate-500" : "text-slate-300"
                    )}>
                        Existing FAQs
                    </span>
                    {isLoading && (
                        <span className="text-xs text-slate-400 animate-pulse">Loading...</span>
                    )}
                </div>
                <div className={cn(
                    "divide-y",
                    isLight ? "divide-slate-50" : "divide-white/5"
                )}>
                    {faqs.length === 0 && !isLoading ? (
                        <div className="px-4 py-10 text-sm text-slate-400 text-center">
                            No FAQs yet. Add your first common question above or
                            import from JSON.
                        </div>
                    ) : (
                        faqs.map((faq) => (
                            <div key={faq.id} className="px-4 py-4 text-sm hover:bg-slate-50/50 transition-colors group">
                                <p className={cn("font-semibold", isLight ? "text-slate-900" : "text-white")}>
                                    {faq.question}
                                </p>
                                <p className={cn("mt-1.5 text-[13px] leading-relaxed", isLight ? "text-slate-600" : "text-slate-300")}>
                                    {faq.answer}
                                </p>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    )
}

