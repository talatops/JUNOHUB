"use client"

import { useState } from "react"
import { useTheme } from "@/components/ThemeProvider"
import { cn } from "@/lib/utils"

type AskSectionProps = {
    storeId: string
}

type Source = {
    id: string
    type: "DOCUMENT" | "FAQ" | "STRUCTURED"
    documentId: string | null
    faqId: string | null
    similarity: number
}

export function AskSection({ storeId }: AskSectionProps) {
    const { theme } = useTheme()
    const isLight = theme === "light"
    const [query, setQuery] = useState("")
    const [includeFaq, setIncludeFaq] = useState(true)
    const [includeDocuments, setIncludeDocuments] = useState(true)
    const [includeStructured, setIncludeStructured] = useState(true)
    const [answer, setAnswer] = useState<string | null>(null)
    const [sources, setSources] = useState<Source[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function handleAsk(e: React.FormEvent) {
        e.preventDefault()
        if (!query.trim()) return

        try {
            setIsLoading(true)
            setError(null)
            setAnswer(null)
            setSources([])

            const res = await fetch(
                `/api/stores/${encodeURIComponent(storeId)}/kb/query`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        query: query.trim(),
                        includeFaq,
                        includeDocuments,
                        includeStructured,
                    }),
                },
            )

            const json = await res.json().catch(() => ({}))
            if (!res.ok) {
                throw new Error(json.message || "Failed to query knowledge base")
            }

            setAnswer(json.answer || null)
            setSources((json.sources || []) as Source[])
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Failed to query knowledge base",
            )
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="space-y-4">
            <div>
                <h3 className={cn("text-lg font-semibold", isLight ? "text-slate-900" : "text-white")}>Ask JUNO</h3>
                <p className={cn("text-xs", isLight ? "text-slate-500" : "text-slate-400")}>
                    Ask questions across documents, FAQs, and your structured store profile.
                    The AI uses only your knowledge base.
                </p>
            </div>

            {error && (
                <div className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                    {error}
                </div>
            )}

            <form
                onSubmit={handleAsk}
                className={cn(
                    "border rounded-xl p-4 space-y-4 transition-all",
                    isLight ? "bg-white border-slate-100 shadow-sm" : "bg-slate-900/40 border-white/5 backdrop-blur-sm"
                )}
            >
                <textarea
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="e.g. How long do customers have to return an item?"
                    className={cn(
                        "w-full px-4 py-3 rounded-lg border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 min-h-[120px]",
                        isLight
                            ? "bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400"
                            : "bg-slate-950/60 border-white/10 text-white placeholder:text-slate-500"
                    )}
                />
                <div className="flex items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-4 text-xs">
                        <label className={cn(
                            "inline-flex items-center gap-2 cursor-pointer transition-colors",
                            isLight ? "text-slate-600 hover:text-slate-900" : "text-slate-400 hover:text-white"
                        )}>
                            <input
                                type="checkbox"
                                className="rounded border-slate-300 bg-white text-indigo-600 focus:ring-indigo-500/20"
                                checked={includeDocuments}
                                onChange={(e) =>
                                    setIncludeDocuments(e.target.checked)
                                }
                            />
                            <span className="font-medium">Use documents</span>
                        </label>
                        <label className={cn(
                            "inline-flex items-center gap-2 cursor-pointer transition-colors",
                            isLight ? "text-slate-600 hover:text-slate-900" : "text-slate-400 hover:text-white"
                        )}>
                            <input
                                type="checkbox"
                                className="rounded border-slate-300 bg-white text-indigo-600 focus:ring-indigo-500/20"
                                checked={includeStructured}
                                onChange={(e) =>
                                    setIncludeStructured(e.target.checked)
                                }
                            />
                            <span className="font-medium">Use structured profile</span>
                        </label>
                        <label className={cn(
                            "inline-flex items-center gap-2 cursor-pointer transition-colors",
                            isLight ? "text-slate-600 hover:text-slate-900" : "text-slate-400 hover:text-white"
                        )}>
                            <input
                                type="checkbox"
                                className="rounded border-slate-300 bg-white text-indigo-600 focus:ring-indigo-500/20"
                                checked={includeFaq}
                                onChange={(e) => setIncludeFaq(e.target.checked)}
                            />
                            <span className="font-medium">Use FAQs</span>
                        </label>
                    </div>
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="inline-flex items-center px-6 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-xs font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                    >
                        {isLoading ? (
                            <span className="flex items-center gap-2">
                                <svg className="animate-spin h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Thinking...
                            </span>
                        ) : "Ask JUNO"}
                    </button>
                </div>
            </form>

            {answer && (
                <div className={cn(
                    "border rounded-xl p-6 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300",
                    isLight ? "bg-indigo-50/30 border-indigo-100" : "bg-slate-900/60 border-white/5 backdrop-blur-sm"
                )}>
                    <div>
                        <h4 className={cn("text-[11px] font-bold uppercase tracking-wider mb-2", isLight ? "text-indigo-600" : "text-slate-400")}>
                            Answer
                        </h4>
                        <p className={cn("text-[15px] leading-relaxed whitespace-pre-wrap", isLight ? "text-slate-800" : "text-slate-100")}>
                            {answer}
                        </p>
                    </div>
                    {sources.length > 0 && (
                        <div className={cn("border-t pt-4", isLight ? "border-indigo-100" : "border-white/10")}>
                            <h5 className={cn("text-[11px] font-bold uppercase tracking-wider mb-2", isLight ? "text-indigo-600" : "text-slate-400")}>
                                Sources
                            </h5>
                            <ul className="space-y-2 text-xs">
                                {sources.map((source, index) => (
                                    <li key={source.id} className="flex items-center gap-2">
                                        <span className={cn(
                                            "inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 text-[10px] font-bold",
                                            isLight ? "text-slate-600" : "text-slate-400 bg-slate-800"
                                        )}>
                                            {source.type === "FAQ"
                                                ? "FAQ"
                                                : source.type === "STRUCTURED"
                                                  ? "Profile"
                                                  : "Document"}
                                        </span>
                                        <span className={isLight ? "text-slate-500" : "text-slate-400"}>
                                            Source #{index + 1}
                                        </span>
                                        <span className="text-slate-400 ml-auto">
                                            Similarity: {(source.similarity * 100).toFixed(0)}%
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

