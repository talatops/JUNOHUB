"use client"

import { useCallback, useEffect, useState } from "react"
import { createPortal } from "react-dom"
import {
    STORE_VOICE_FIELDS,
    KNOWLEDGE_TEMPLATE_ANSWER_MAX,
    type StoreVoiceFieldKey,
    type KnowledgeTemplateStored,
} from "@/lib/kb/knowledgeTemplate"
import { cn } from "@/lib/utils"
import { Loader2, Save, X } from "lucide-react"

type StructuredKnowledgeModalProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    storeId: string
    knowledgeBaseMode: "UNSET" | "STRUCTURED" | "DOCUMENTS"
    onSaved: () => void | Promise<void>
    isLight: boolean
}

export function StructuredKnowledgeModal({
    open,
    onOpenChange,
    storeId,
    knowledgeBaseMode,
    onSaved,
    isLight,
}: StructuredKnowledgeModalProps) {
    const [mounted, setMounted] = useState(false)
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const [answers, setAnswers] = useState<Record<StoreVoiceFieldKey, string>>(
        () =>
            STORE_VOICE_FIELDS.reduce(
                (acc, f) => {
                    acc[f.key] = ""
                    return acc
                },
                {} as Record<StoreVoiceFieldKey, string>,
            ),
    )

    const loadForm = useCallback(async () => {
        const res = await fetch(`/api/stores/${encodeURIComponent(storeId)}/knowledge-template`)
        if (!res.ok) return
        const data = (await res.json()) as {
            knowledgeTemplate: KnowledgeTemplateStored | null
        }
        const tmpl = data.knowledgeTemplate
        setAnswers((prev) => {
            const next = { ...prev }
            for (const f of STORE_VOICE_FIELDS) {
                const v = tmpl?.genericAnswers?.[f.key]
                next[f.key] = typeof v === "string" ? v : ""
            }
            return next
        })
    }, [storeId])

    useEffect(() => {
        setMounted(true)
    }, [])

    useEffect(() => {
        if (!open || !storeId) return
        let cancelled = false
            ; (async () => {
                try {
                    setLoading(true)
                    setError(null)
                    await loadForm()
                } finally {
                    if (!cancelled) setLoading(false)
                }
            })()
        return () => {
            cancelled = true
        }
    }, [open, storeId, loadForm])

    useEffect(() => {
        if (!open) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onOpenChange(false)
        }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [open, onOpenChange])

    useEffect(() => {
        if (open) {
            document.body.style.overflow = "hidden"
        } else {
            document.body.style.overflow = ""
        }
        return () => {
            document.body.style.overflow = ""
        }
    }, [open])

    async function handleSave(e: React.FormEvent) {
        e.preventDefault()
        setSaving(true)
        setError(null)

        const payload: Record<string, unknown> = {
            template: {
                answers,
            },
        }

        if (knowledgeBaseMode === "DOCUMENTS") {
            payload.knowledgeBaseMode = "STRUCTURED"
        }

        const trySave = async (confirmDestructiveSwitch?: boolean) => {
            const body = {
                ...payload,
                ...(confirmDestructiveSwitch ? { confirmDestructiveSwitch: true } : {}),
            }
            const res = await fetch(`/api/stores/${encodeURIComponent(storeId)}/knowledge-template`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            })
            const j = await res.json().catch(() => ({}))
            if (res.status === 400 && j.code === "CONFIRM_REQUIRED") {
                const ok = window.confirm(
                    "Switching to structured knowledge will remove all uploaded documents and FAQs for this store. Continue?",
                )
                if (!ok) return false
                return await trySave(true)
            }
            if (!res.ok) {
                throw new Error(j.message || "Failed to save")
            }
            return true
        }

        try {
            const ok = await trySave()
            if (ok) {
                await onSaved()
                onOpenChange(false)
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save")
        } finally {
            setSaving(false)
        }
    }

    if (!mounted || !open) return null

    const panelClass = isLight
        ? "bg-white border-slate-200 text-slate-900 shadow-xl"
        : "bg-slate-900/95 border-white/10 text-white shadow-2xl backdrop-blur-xl"

    return createPortal(
        <div
            className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="structured-kb-title"
        >
            <button
                type="button"
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                aria-label="Close dialog"
                onClick={() => onOpenChange(false)}
            />
            <div
                className={cn(
                    "relative flex min-h-0 w-full max-h-[92vh] flex-col rounded-t-2xl border sm:mx-4 sm:max-h-[90vh] sm:rounded-2xl",
                    "sm:max-w-lg lg:max-w-xl",
                    panelClass,
                )}
                onClick={(e) => e.stopPropagation()}
            >
                <div
                    className={cn(
                        "flex items-start justify-between gap-3 px-5 py-4 border-b shrink-0",
                        isLight ? "border-slate-100" : "border-white/10",
                    )}
                >
                    <div>
                        <h2
                            id="structured-kb-title"
                            className={cn(
                                "text-lg font-bold tracking-tight",
                                isLight ? "text-slate-900" : "text-white",
                            )}
                        >
                            Store voice for AI
                        </h2>
                        <p
                            className={cn(
                                "text-xs mt-1",
                                isLight ? "text-slate-500" : "text-slate-400",
                            )}
                        >
                            A few basics about tone and boundaries. Per-topic policies live under{" "}
                            <span className="font-semibold">JUNO Engine → AI modules</span>.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => onOpenChange(false)}
                        className={cn(
                            "p-2 rounded-lg transition-colors shrink-0",
                            isLight
                                ? "hover:bg-slate-100 text-slate-500"
                                : "hover:bg-white/10 text-slate-400",
                        )}
                        aria-label="Close"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Loading…
                    </div>
                ) : (
                    <form
                        onSubmit={(e) => void handleSave(e)}
                        className="flex min-h-0 flex-1 flex-col"
                    >
                        <div
                            className={cn(
                                "custom-scrollbar min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4",
                            )}
                        >
                            {error && (
                                <div
                                    className={cn(
                                        "text-xs rounded-lg px-3 py-2 border",
                                        isLight
                                            ? "text-red-600 bg-red-50 border-red-100"
                                            : "text-red-400 bg-red-500/10 border-red-500/20",
                                    )}
                                >
                                    {error}
                                </div>
                            )}

                            {STORE_VOICE_FIELDS.map((field) => (
                                <div key={field.key}>
                                    <label
                                        className={cn(
                                            "block text-sm font-semibold",
                                            isLight ? "text-slate-900" : "text-white",
                                        )}
                                    >
                                        {field.label}
                                    </label>
                                    <p
                                        className={cn(
                                            "text-[11px] leading-snug mt-0.5 mb-1.5",
                                            isLight ? "text-slate-500" : "text-slate-500",
                                        )}
                                    >
                                        {field.description}
                                    </p>
                                    <textarea
                                        value={answers[field.key]}
                                        onChange={(e) =>
                                            setAnswers((a) => ({
                                                ...a,
                                                [field.key]: e.target.value.slice(
                                                    0,
                                                    KNOWLEDGE_TEMPLATE_ANSWER_MAX,
                                                ),
                                            }))
                                        }
                                        placeholder={field.placeholder}
                                        rows={3}
                                        maxLength={KNOWLEDGE_TEMPLATE_ANSWER_MAX}
                                        className={cn(
                                            "w-full px-3 py-2 rounded-lg border text-sm resize-y min-h-[72px] focus:outline-none focus:ring-2 focus:ring-indigo-500/30",
                                            isLight
                                                ? "bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400"
                                                : "bg-slate-950/50 border-white/10 text-white placeholder:text-slate-500",
                                        )}
                                    />
                                </div>
                            ))}
                        </div>

                        <div
                            className={cn(
                                "flex items-center justify-end gap-2 px-5 py-4 border-t shrink-0",
                                isLight ? "border-slate-100 bg-slate-50/80" : "border-white/10 bg-slate-950/50",
                            )}
                        >
                            <button
                                type="button"
                                onClick={() => onOpenChange(false)}
                                className={cn(
                                    "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                                    isLight
                                        ? "text-slate-600 hover:bg-slate-200/80"
                                        : "text-slate-300 hover:bg-white/10",
                                )}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={saving}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold disabled:opacity-50"
                            >
                                {saving ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Save className="w-4 h-4" />
                                )}
                                Save &amp; embed
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>,
        document.body,
    )
}
