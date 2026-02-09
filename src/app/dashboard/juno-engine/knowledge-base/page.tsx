"use client"

import { useEffect, useState } from "react"
import { DocumentsSection } from "@/components/kb/DocumentsSection"
import { FaqSection } from "@/components/kb/FaqSection"
import { AskSection } from "@/components/kb/AskSection"

export default function KnowledgeBasePage() {
    const [activeStoreId, setActiveStoreId] = useState<string | null>(null)

    useEffect(() => {
        let cancelled = false

        ;(async () => {
            try {
                const res = await fetch("/api/stores")
                if (!res.ok) return

                const data = (await res.json()) as {
                    stores?: { id: string; isActive: boolean }[]
                }
                const active = (data.stores || []).find((s) => s.isActive)

                if (!cancelled) {
                    setActiveStoreId(active?.id ?? null)
                }
            } catch {
                if (!cancelled) {
                    setActiveStoreId(null)
                }
            }
        })()

        return () => {
            cancelled = true
        }
    }, [])

    const [activeTab, setActiveTab] = useState<"documents" | "faqs" | "ask">(
        "documents",
    )

    const hasStore = Boolean(activeStoreId)

    return (
        <div className="flex flex-col h-full space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">
                        Knowledge Base
                    </h1>
                    <p className="text-sm text-slate-400">
                        Centralize your store&apos;s documents and FAQs so JUNO can
                        answer customer and vendor questions.
                    </p>
                </div>
            </div>

            {!hasStore ? (
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center max-w-md">
                        <h2 className="text-lg font-semibold text-white mb-2">
                            No active store selected
                        </h2>
                        <p className="text-sm text-slate-400">
                            Select a store from the top bar to manage its knowledge
                            base.
                        </p>
                    </div>
                </div>
            ) : (
                <>
                    <div className="flex items-center space-x-2 border-b border-white/10">
                        <button
                            type="button"
                            onClick={() => setActiveTab("documents")}
                            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                                activeTab === "documents"
                                    ? "border-indigo-500 text-white"
                                    : "border-transparent text-slate-400 hover:text-white hover:border-slate-500"
                            }`}
                        >
                            Documents
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab("faqs")}
                            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                                activeTab === "faqs"
                                    ? "border-indigo-500 text-white"
                                    : "border-transparent text-slate-400 hover:text-white hover:border-slate-500"
                            }`}
                        >
                            FAQs
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab("ask")}
                            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                                activeTab === "ask"
                                    ? "border-indigo-500 text-white"
                                    : "border-transparent text-slate-400 hover:text-white hover:border-slate-500"
                            }`}
                        >
                            Ask
                        </button>
                    </div>

                    <div className="flex-1 min-h-0 overflow-y-auto pb-4">
                        {activeTab === "documents" && (
                            <DocumentsSection storeId={activeStoreId!} />
                        )}
                        {activeTab === "faqs" && (
                            <FaqSection storeId={activeStoreId!} />
                        )}
                        {activeTab === "ask" && (
                            <AskSection storeId={activeStoreId!} />
                        )}
                    </div>
                </>
            )}
        </div>
    )
}

