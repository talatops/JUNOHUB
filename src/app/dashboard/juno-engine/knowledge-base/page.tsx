"use client"

import { useCallback, useEffect, useState } from "react"
import { DocumentsFaqKnowledgeModal } from "@/components/kb/DocumentsFaqKnowledgeModal"
import { StructuredKnowledgeModal } from "@/components/kb/StructuredKnowledgeModal"
import { useTheme } from "@/components/ThemeProvider"
import { cn } from "@/lib/utils"
import type { KnowledgeTemplateStored } from "@/lib/kb/knowledgeTemplate"
import { BookOpen, ChevronRight, FileStack, Loader2 } from "lucide-react"

type KbCounts = {
    documents: number
    faqs: number
    structuredChunks: number
}

export default function KnowledgeBasePage() {
    const { theme } = useTheme()
    const isLight = theme === "light"
    const [activeStoreId, setActiveStoreId] = useState<string | null>(null)
    const [kbLoading, setKbLoading] = useState(true)
    const [knowledgeBaseMode, setKnowledgeBaseMode] = useState<
        "UNSET" | "STRUCTURED" | "DOCUMENTS"
    >("UNSET")
    const [structuredOpen, setStructuredOpen] = useState(false)
    const [documentsModalOpen, setDocumentsModalOpen] = useState(false)
    const [modeBusy, setModeBusy] = useState<"documents" | null>(null)
    const [toast, setToast] = useState<string | null>(null)

    const loadKb = useCallback(async (sid: string) => {
        const res = await fetch(`/api/stores/${encodeURIComponent(sid)}/knowledge-template`)
        if (!res.ok) return
        const j = (await res.json()) as {
            knowledgeBaseMode: "UNSET" | "STRUCTURED" | "DOCUMENTS"
            knowledgeTemplate: KnowledgeTemplateStored | null
            counts: KbCounts
        }
        setKnowledgeBaseMode(j.knowledgeBaseMode)
    }, [])

    useEffect(() => {
        let cancelled = false
            ; (async () => {
                try {
                    const res = await fetch("/api/stores")
                    if (!res.ok) return
                    const data = (await res.json()) as {
                        stores?: { id: string; isActive: boolean }[]
                    }
                    const active = (data.stores || []).find((s) => s.isActive)
                    if (!cancelled) setActiveStoreId(active?.id ?? null)
                } catch {
                    if (!cancelled) setActiveStoreId(null)
                }
            })()
        return () => {
            cancelled = true
        }
    }, [])

    useEffect(() => {
        if (!activeStoreId) {
            setKbLoading(false)
            setKnowledgeBaseMode("UNSET")
            return
        }
        let cancelled = false
            ; (async () => {
                try {
                    setKbLoading(true)
                    await loadKb(activeStoreId)
                } finally {
                    if (!cancelled) setKbLoading(false)
                }
            })()
        return () => {
            cancelled = true
        }
    }, [activeStoreId, loadKb])

    async function ensureDocumentsMode(
        confirmDestructiveSwitch?: boolean,
    ): Promise<boolean> {
        if (!activeStoreId) return false
        if (knowledgeBaseMode === "DOCUMENTS") return true

        setModeBusy("documents")
        setToast(null)
        try {
            const res = await fetch(
                `/api/stores/${encodeURIComponent(activeStoreId)}/knowledge-template`,
                {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        knowledgeBaseMode: "DOCUMENTS",
                        ...(confirmDestructiveSwitch
                            ? { confirmDestructiveSwitch: true }
                            : {}),
                    }),
                },
            )
            const j = await res.json().catch(() => ({}))
            if (res.status === 400 && j.code === "CONFIRM_REQUIRED") {
                const ok = window.confirm(
                    "This removes your structured profile and its embeddings. Continue?",
                )
                if (!ok) return false
                return await ensureDocumentsMode(true)
            }
            if (!res.ok) {
                throw new Error(j.message || "Failed to update mode")
            }
            await loadKb(activeStoreId)
            setToast("Using documents & FAQs for this store.")
            return true
        } catch (e) {
            setToast(e instanceof Error ? e.message : "Could not switch mode")
            return false
        } finally {
            setModeBusy(null)
        }
    }

    async function openDocumentsKnowledgePanel() {
        if (!activeStoreId) return
        const ok = await ensureDocumentsMode()
        if (ok) setDocumentsModalOpen(true)
    }

    const hasStore = Boolean(activeStoreId)
    const structuredActive = knowledgeBaseMode === "STRUCTURED"

    const modeLabel =
        knowledgeBaseMode === "STRUCTURED"
            ? "Store voice (structured)"
            : knowledgeBaseMode === "DOCUMENTS"
              ? "Documents & FAQs"
              : "Not chosen yet"

    return (
        <div className="flex flex-col h-full space-y-5">
            <div>
                <h1
                    className={cn(
                        "text-2xl font-bold tracking-tight",
                        isLight ? "text-slate-900" : "text-white",
                    )}
                >
                    Knowledge base
                </h1>
                <p
                    className={cn(
                        "text-sm mt-1 max-w-2xl",
                        isLight ? "text-slate-500" : "text-slate-400",
                    )}
                >
                    Store voice lives here; per-topic policies and automation toggles live under{" "}
                    <span className="font-semibold">JUNO Engine → AI modules</span>. Or use uploaded
                    docs &amp; FAQs—not both with structured mode.
                </p>
            </div>

            {!hasStore ? (
                <div className="flex-1 flex items-center justify-center py-16">
                    <p
                        className={cn(
                            "text-sm text-center max-w-sm",
                            isLight ? "text-slate-500" : "text-slate-400",
                        )}
                    >
                        Select an active store from the top bar to manage its knowledge
                        base.
                    </p>
                </div>
            ) : kbLoading ? (
                <div className="flex items-center gap-2 text-sm text-slate-400 py-8">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading…
                </div>
            ) : (
                <>
                    <div
                        id="kb-source"
                        className={cn(
                            "rounded-xl border p-4 scroll-mt-4",
                            isLight
                                ? "border-slate-200 bg-white shadow-sm"
                                : "border-white/10 bg-white/[0.04]",
                        )}
                    >
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                            <div>
                                <p
                                    className={cn(
                                        "text-[11px] font-bold uppercase tracking-wider",
                                        isLight ? "text-slate-400" : "text-slate-500",
                                    )}
                                >
                                    Knowledge source
                                </p>
                                <p
                                    className={cn(
                                        "text-sm font-medium mt-0.5",
                                        isLight ? "text-slate-800" : "text-slate-200",
                                    )}
                                >
                                    {modeLabel}
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                            <button
                                type="button"
                                onClick={() => setStructuredOpen(true)}
                                className={cn(
                                    "flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-all",
                                    knowledgeBaseMode === "STRUCTURED"
                                        ? isLight
                                            ? "border-indigo-400 bg-indigo-50/80 ring-1 ring-indigo-200"
                                            : "border-indigo-500/50 bg-indigo-500/10"
                                        : isLight
                                          ? "border-slate-200 hover:border-slate-300 hover:bg-slate-50/80"
                                          : "border-white/10 hover:border-white/20 hover:bg-white/[0.06]",
                                )}
                            >
                                <div
                                    className={cn(
                                        "flex h-10 w-10 items-center justify-center rounded-lg shrink-0",
                                        isLight ? "bg-indigo-100" : "bg-indigo-500/20",
                                    )}
                                >
                                    <BookOpen
                                        className={cn(
                                            "h-5 w-5",
                                            isLight ? "text-indigo-600" : "text-indigo-300",
                                        )}
                                    />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p
                                        className={cn(
                                            "text-sm font-semibold",
                                            isLight ? "text-slate-900" : "text-white",
                                        )}
                                    >
                                        Store voice
                                    </p>
                                    <p
                                        className={cn(
                                            "text-xs mt-0.5 line-clamp-2",
                                            isLight ? "text-slate-500" : "text-slate-400",
                                        )}
                                    >
                                        Tone &amp; boundaries · policies in AI modules
                                    </p>
                                </div>
                                <ChevronRight
                                    className={cn(
                                        "h-4 w-4 shrink-0",
                                        isLight ? "text-slate-400" : "text-slate-500",
                                    )}
                                />
                            </button>

                            <button
                                type="button"
                                disabled={modeBusy !== null}
                                onClick={() => void openDocumentsKnowledgePanel()}
                                className={cn(
                                    "flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-all disabled:opacity-60 disabled:cursor-not-allowed",
                                    knowledgeBaseMode === "DOCUMENTS"
                                        ? isLight
                                            ? "border-emerald-400 bg-emerald-50/80 ring-1 ring-emerald-200"
                                            : "border-emerald-500/50 bg-emerald-500/10"
                                        : isLight
                                          ? "border-slate-200 hover:border-slate-300 hover:bg-slate-50/80"
                                          : "border-white/10 hover:border-white/20 hover:bg-white/[0.06]",
                                )}
                            >
                                <div
                                    className={cn(
                                        "flex h-10 w-10 items-center justify-center rounded-lg shrink-0",
                                        isLight ? "bg-emerald-100" : "bg-emerald-500/20",
                                    )}
                                >
                                    {modeBusy === "documents" ? (
                                        <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
                                    ) : (
                                        <FileStack
                                            className={cn(
                                                "h-5 w-5",
                                                isLight
                                                    ? "text-emerald-700"
                                                    : "text-emerald-300",
                                            )}
                                        />
                                    )}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p
                                        className={cn(
                                            "text-sm font-semibold",
                                            isLight ? "text-slate-900" : "text-white",
                                        )}
                                    >
                                        Documents &amp; FAQs
                                    </p>
                                    <p
                                        className={cn(
                                            "text-xs mt-0.5 line-clamp-2",
                                            isLight ? "text-slate-500" : "text-slate-400",
                                        )}
                                    >
                                        PDFs, FAQs &amp; Ask · opens in a panel
                                    </p>
                                </div>
                                <ChevronRight
                                    className={cn(
                                        "h-4 w-4 shrink-0",
                                        isLight ? "text-slate-400" : "text-slate-500",
                                    )}
                                />
                            </button>
                        </div>

                        {toast && (
                            <p
                                className={cn(
                                    "text-xs mt-3 px-1",
                                    toast.includes("Could not") || toast.includes("Failed")
                                        ? isLight
                                            ? "text-amber-700"
                                            : "text-amber-400"
                                        : isLight
                                          ? "text-emerald-700"
                                          : "text-emerald-400/90",
                                )}
                            >
                                {toast}
                            </p>
                        )}
                    </div>

                    {structuredActive && (
                        <p
                            className={cn(
                                "text-xs",
                                isLight ? "text-slate-500" : "text-slate-500",
                            )}
                        >
                            You&apos;re on store voice (structured). Open{" "}
                            <button
                                type="button"
                                onClick={() => setStructuredOpen(true)}
                                className="font-semibold text-indigo-500 hover:underline"
                            >
                                Store voice
                            </button>{" "}
                            to edit, or choose{" "}
                            <button
                                type="button"
                                onClick={() => void openDocumentsKnowledgePanel()}
                                className="font-semibold text-emerald-600 hover:underline dark:text-emerald-400"
                            >
                                Documents &amp; FAQs
                            </button>{" "}
                            to switch (you&apos;ll confirm replacing structured data).
                        </p>
                    )}

                    <StructuredKnowledgeModal
                        open={structuredOpen}
                        onOpenChange={setStructuredOpen}
                        storeId={activeStoreId!}
                        knowledgeBaseMode={knowledgeBaseMode}
                        isLight={isLight}
                        onSaved={async () => {
                            await loadKb(activeStoreId!)
                            setToast("Store voice saved and embedded.")
                        }}
                    />

                    <DocumentsFaqKnowledgeModal
                        open={documentsModalOpen}
                        onOpenChange={setDocumentsModalOpen}
                        storeId={activeStoreId!}
                        isLight={isLight}
                    />
                </>
            )}
        </div>
    )
}
