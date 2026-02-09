"use client"

import { useState } from "react"

type AskSectionProps = {
    storeId: string
}

type Source = {
    id: string
    type: "DOCUMENT" | "FAQ"
    documentId: string | null
    faqId: string | null
    similarity: number
}

export function AskSection({ storeId }: AskSectionProps) {
    const [query, setQuery] = useState("")
    const [includeFaq, setIncludeFaq] = useState(true)
    const [includeDocuments, setIncludeDocuments] = useState(true)
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
                <h3 className="text-lg font-semibold text-white">Ask JUNO</h3>
                <p className="text-xs text-slate-400">
                    Ask questions across your store&apos;s documents and FAQs. The
                    AI will answer using only your knowledge base.
                </p>
            </div>

            {error && (
                <div className="text-xs text-red-400 bg-red-950/40 border border-red-900/50 rounded-md px-3 py-2">
                    {error}
                </div>
            )}

            <form
                onSubmit={handleAsk}
                className="border border-white/5 rounded-xl bg-slate-900/40 backdrop-blur-sm p-4 space-y-3"
            >
                <textarea
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="e.g. How long do customers have to return an item?"
                    className="w-full px-3 py-2 rounded-lg bg-slate-950/60 border border-white/10 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/70 focus:border-indigo-500/70 min-h-[80px]"
                />
                <div className="flex items-center justify-between gap-4 text-xs text-slate-300">
                    <div className="flex items-center gap-3">
                        <label className="inline-flex items-center gap-2">
                            <input
                                type="checkbox"
                                className="rounded border-slate-600 bg-slate-900 text-indigo-500"
                                checked={includeDocuments}
                                onChange={(e) =>
                                    setIncludeDocuments(e.target.checked)
                                }
                            />
                            <span>Use documents</span>
                        </label>
                        <label className="inline-flex items-center gap-2">
                            <input
                                type="checkbox"
                                className="rounded border-slate-600 bg-slate-900 text-indigo-500"
                                checked={includeFaq}
                                onChange={(e) => setIncludeFaq(e.target.checked)}
                            />
                            <span>Use FAQs</span>
                        </label>
                    </div>
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="inline-flex items-center px-3 py-2 rounded-lg bg-indigo-600/80 hover:bg-indigo-600 text-xs font-medium text-white disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                    >
                        {isLoading ? "Thinking..." : "Ask"}
                    </button>
                </div>
            </form>

            {answer && (
                <div className="border border-white/5 rounded-xl bg-slate-900/60 backdrop-blur-sm p-4 space-y-3">
                    <div>
                        <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wide mb-1">
                            Answer
                        </h4>
                        <p className="text-sm text-slate-100 whitespace-pre-wrap">
                            {answer}
                        </p>
                    </div>
                    {sources.length > 0 && (
                        <div className="border-t border-white/10 pt-3">
                            <h5 className="text-xs font-semibold text-slate-300 uppercase tracking-wide mb-1">
                                Sources
                            </h5>
                            <ul className="space-y-1 text-xs text-slate-400">
                                {sources.map((source, index) => (
                                    <li key={source.id}>
                                        <span className="font-medium text-slate-200">
                                            {source.type === "FAQ"
                                                ? "FAQ"
                                                : "Document"}{" "}
                                            #{index + 1}
                                        </span>
                                        <span className="ml-2 text-slate-500">
                                            (similarity:{" "}
                                            {source.similarity.toFixed(2)})
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

