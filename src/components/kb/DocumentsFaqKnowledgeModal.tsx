"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { DocumentsSection } from "@/components/kb/DocumentsSection"
import { FaqSection } from "@/components/kb/FaqSection"
import { AskSection } from "@/components/kb/AskSection"
import { cn } from "@/lib/utils"
import { X } from "lucide-react"

type TabId = "documents" | "faqs" | "ask"

type DocumentsFaqKnowledgeModalProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    storeId: string
    isLight: boolean
}

export function DocumentsFaqKnowledgeModal({
    open,
    onOpenChange,
    storeId,
    isLight,
}: DocumentsFaqKnowledgeModalProps) {
    const [mounted, setMounted] = useState(false)
    const [tab, setTab] = useState<TabId>("documents")

    useEffect(() => {
        setMounted(true)
    }, [])

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

    if (!mounted || !open) return null

    const panelClass = isLight
        ? "bg-white border-slate-200 text-slate-900 shadow-xl"
        : "bg-slate-900/95 border-white/10 text-white shadow-2xl backdrop-blur-xl"

    const tabs: { id: TabId; label: string }[] = [
        { id: "documents", label: "Documents" },
        { id: "faqs", label: "FAQs" },
        { id: "ask", label: "Ask" },
    ]

    return createPortal(
        <div
            className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="docs-kb-modal-title"
        >
            <button
                type="button"
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                aria-label="Close dialog"
                onClick={() => onOpenChange(false)}
            />
            <div
                className={cn(
                    "relative flex w-full flex-col rounded-t-2xl border sm:rounded-2xl",
                    "max-h-[92vh] sm:max-h-[88vh] sm:max-w-4xl lg:max-w-5xl",
                    panelClass,
                    "sm:mx-4",
                )}
                onClick={(e) => e.stopPropagation()}
            >
                <div
                    className={cn(
                        "flex shrink-0 items-start justify-between gap-3 border-b px-5 py-4",
                        isLight ? "border-slate-100" : "border-white/10",
                    )}
                >
                    <div>
                        <h2
                            id="docs-kb-modal-title"
                            className={cn(
                                "text-lg font-bold tracking-tight sm:text-xl",
                                isLight ? "text-slate-900" : "text-white",
                            )}
                        >
                            Documents &amp; FAQs
                        </h2>
                        <p
                            className={cn(
                                "mt-1 max-w-xl text-xs sm:text-sm",
                                isLight ? "text-slate-500" : "text-slate-400",
                            )}
                        >
                            Upload files, manage FAQs, and test retrieval with Ask—all for
                            this store.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => onOpenChange(false)}
                        className={cn(
                            "shrink-0 rounded-lg p-2 transition-colors",
                            isLight
                                ? "text-slate-500 hover:bg-slate-100"
                                : "text-slate-400 hover:bg-white/10",
                        )}
                        aria-label="Close"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div
                    className={cn(
                        "flex shrink-0 gap-1 border-b px-4 pt-2",
                        isLight ? "border-slate-100" : "border-white/10",
                    )}
                >
                    {tabs.map((t) => (
                        <button
                            key={t.id}
                            type="button"
                            onClick={() => setTab(t.id)}
                            className={cn(
                                "rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors",
                                tab === t.id
                                    ? isLight
                                        ? "bg-slate-100 text-indigo-600"
                                        : "bg-white/10 text-indigo-300"
                                    : isLight
                                      ? "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                                      : "text-slate-400 hover:bg-white/5 hover:text-white",
                            )}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                <div
                    className={cn(
                        "min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5",
                        "max-h-[calc(92vh-11rem)] sm:max-h-[calc(88vh-10rem)]",
                    )}
                >
                    {tab === "documents" && (
                        <DocumentsSection storeId={storeId} locked={false} />
                    )}
                    {tab === "faqs" && <FaqSection storeId={storeId} locked={false} />}
                    {tab === "ask" && <AskSection storeId={storeId} />}
                </div>
            </div>
        </div>,
        document.body,
    )
}
