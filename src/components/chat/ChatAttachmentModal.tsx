"use client"

import { useEffect } from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"
import { Package, ShoppingCart, X } from "lucide-react"

export type ChatAttachmentKind = "PRODUCT" | "ORDER"

interface ChatAttachmentModalProps {
    isOpen: boolean
    onClose: () => void
    kind: ChatAttachmentKind | null
    attachment: any
    isLight: boolean
}

export function ChatAttachmentModal({
    isOpen,
    onClose,
    kind,
    attachment,
    isLight,
}: ChatAttachmentModalProps) {
    if (!isOpen || !kind || !attachment) return null

    const title =
        kind === "PRODUCT"
            ? attachment.title || "Attached product"
            : `Order ${attachment.orderNumber || ""}`.trim()

    useEffect(() => {
        if (!isOpen) return
        const prevOverflow = document.body.style.overflow
        document.body.style.overflow = "hidden"

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose()
        }
        window.addEventListener("keydown", onKeyDown)

        return () => {
            document.body.style.overflow = prevOverflow
            window.removeEventListener("keydown", onKeyDown)
        }
    }, [isOpen, onClose])

    const overlay = (
        <div
            className="fixed inset-0 z-[99999] bg-transparent"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose()
            }}
        >
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-xl p-4 py-10">
                <div
                    className={cn(
                        "w-full rounded-2xl border shadow-2xl overflow-hidden",
                        isLight ? "bg-white border-slate-200" : "bg-slate-900/95 border-white/10"
                    )}
                >
                    <div
                        className={cn(
                            "flex items-center justify-between p-4 md:p-5 border-b flex-shrink-0",
                            isLight ? "border-slate-200 bg-white" : "border-white/10 bg-slate-900/95"
                        )}
                    >
                        <div className="flex items-center gap-3 min-w-0">
                            <div
                                className={cn(
                                    "w-10 h-10 rounded-xl flex items-center justify-center",
                                    isLight
                                        ? "bg-indigo-100 text-indigo-600"
                                        : "bg-indigo-500/20 text-indigo-300 border border-indigo-500/20"
                                )}
                            >
                                {kind === "PRODUCT" ? <Package className="w-5 h-5" /> : <ShoppingCart className="w-5 h-5" />}
                            </div>
                            <div className="min-w-0">
                                <h3 className={cn("text-sm md:text-base font-black truncate", isLight ? "text-slate-900" : "text-white")}>
                                    {kind === "PRODUCT" ? "Product" : "Order"}
                                </h3>
                                <p className={cn("text-[11px] md:text-xs truncate", isLight ? "text-slate-500" : "text-slate-300/80")}>{title}</p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className={cn(
                                "p-2 rounded-lg transition-colors flex-shrink-0",
                                isLight ? "hover:bg-slate-100 text-slate-600" : "hover:bg-white/10 text-slate-300"
                            )}
                            aria-label="Close attachment modal"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className={cn("p-4 md:p-5 space-y-4", isLight ? "bg-white" : "bg-slate-900/95")}>
                        {kind === "PRODUCT" ? (
                            <div className="flex gap-4">
                                <div className="w-24 h-24 rounded-2xl overflow-hidden bg-black/10 border border-white/10 flex-shrink-0">
                                    {attachment.imageUrl ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                            src={attachment.imageUrl}
                                            alt={attachment.title || "Product image"}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : null}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className={cn("font-black text-base md:text-lg truncate", isLight ? "text-slate-900" : "text-white")}>
                                        {attachment.title || "Product"}
                                    </div>
                                    {attachment.storeName ? (
                                        <div
                                            className={cn(
                                                "text-[11px] font-black uppercase tracking-widest mt-1",
                                                isLight ? "text-indigo-600" : "text-indigo-300"
                                            )}
                                        >
                                            {attachment.storeName}
                                        </div>
                                    ) : null}
                                    {attachment.description ? (
                                        <p className={cn("text-sm mt-2 leading-relaxed", isLight ? "text-slate-600" : "text-slate-300/90")}>
                                            {attachment.description}
                                        </p>
                                    ) : (
                                        <p className={cn("text-sm mt-2 opacity-70", isLight ? "text-slate-500" : "text-slate-400")}>
                                            No description provided.
                                        </p>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="flex gap-4">
                                <div className="w-24 h-24 rounded-2xl overflow-hidden bg-black/10 border border-white/10 flex-shrink-0">
                                    {attachment.primaryImageUrl ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                            src={attachment.primaryImageUrl}
                                            alt="Order image"
                                            className="w-full h-full object-cover"
                                        />
                                    ) : null}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className={cn("font-black text-base md:text-lg truncate", isLight ? "text-slate-900" : "text-white")}>
                                        Order {attachment.orderNumber || ""}
                                    </div>
                                    {attachment.customerName ? (
                                        <div className={cn("text-sm mt-1 leading-relaxed", isLight ? "text-slate-700" : "text-slate-200/90")}>
                                            Customer: {attachment.customerName}
                                        </div>
                                    ) : null}
                                    {attachment.total_price ? (
                                        <div className={cn("text-sm mt-2 font-bold", isLight ? "text-slate-700" : "text-slate-200/90")}>
                                            {attachment.currency ? `${attachment.currency} ` : ""}
                                            {attachment.total_price}
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )

    if (typeof document === "undefined") return overlay
    return createPortal(overlay, document.body)
}

