"use client"

import { useEffect, useState } from "react"

type FaqItem = {
    id: string
    question: string
    answer: string
    tags?: unknown
    createdAt: string
}

type FaqSectionProps = {
    storeId: string
}

export function FaqSection({ storeId }: FaqSectionProps) {
    const [faqs, setFaqs] = useState<FaqItem[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [question, setQuestion] = useState("")
    const [answer, setAnswer] = useState("")
    const [isSaving, setIsSaving] = useState(false)
    const [isImporting, setIsImporting] = useState(false)

    useEffect(() => {
        if (!storeId) return
        ;(async () => {
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
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-white">FAQs</h3>
                    <p className="text-xs text-slate-400">
                        Manage frequently asked questions that your AI can use as
                        trusted answers.
                    </p>
                </div>
                <label className="inline-flex items-center px-3 py-2 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-xs font-medium text-slate-100 cursor-pointer transition-colors border border-white/10">
                    <span>
                        {isImporting ? "Importing..." : "Import from JSON file"}
                    </span>
                    <input
                        type="file"
                        accept="application/json"
                        className="hidden"
                        onChange={handleImport}
                        disabled={isImporting}
                    />
                </label>
            </div>

            {error && (
                <div className="text-xs text-red-400 bg-red-950/40 border border-red-900/50 rounded-md px-3 py-2">
                    {error}
                </div>
            )}

            <form
                onSubmit={handleAddFaq}
                className="border border-white/5 rounded-xl bg-slate-900/40 backdrop-blur-sm p-4 space-y-3"
            >
                <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                        Question
                    </label>
                    <input
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        placeholder="e.g. What is your return policy?"
                        className="w-full px-3 py-2 rounded-lg bg-slate-950/60 border border-white/10 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/70 focus:border-indigo-500/70"
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                        Answer
                    </label>
                    <textarea
                        value={answer}
                        onChange={(e) => setAnswer(e.target.value)}
                        placeholder="Provide a clear, friendly answer that can be shown directly to customers."
                        className="w-full px-3 py-2 rounded-lg bg-slate-950/60 border border-white/10 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/70 focus:border-indigo-500/70 min-h-[80px]"
                    />
                </div>
                <div className="flex justify-end">
                    <button
                        type="submit"
                        disabled={isSaving}
                        className="inline-flex items-center px-3 py-2 rounded-lg bg-indigo-600/80 hover:bg-indigo-600 text-xs font-medium text-white disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                    >
                        {isSaving ? "Saving..." : "Add FAQ"}
                    </button>
                </div>
            </form>

            <div className="border border-white/5 rounded-xl bg-slate-900/40 backdrop-blur-sm">
                <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-300 uppercase tracking-wide">
                        Existing FAQs
                    </span>
                    {isLoading && (
                        <span className="text-xs text-slate-400">Loading...</span>
                    )}
                </div>
                <div className="divide-y divide-white/5">
                    {faqs.length === 0 && !isLoading ? (
                        <div className="px-4 py-6 text-sm text-slate-400 text-center">
                            No FAQs yet. Add your first common question above or
                            import from JSON.
                        </div>
                    ) : (
                        faqs.map((faq) => (
                            <div key={faq.id} className="px-4 py-3 text-sm">
                                <p className="font-medium text-white">
                                    {faq.question}
                                </p>
                                <p className="mt-1 text-xs text-slate-300">
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

