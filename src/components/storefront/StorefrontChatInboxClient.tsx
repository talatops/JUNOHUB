"use client"

import { useEffect, useState } from "react"
import { MessageCircle, MoreHorizontal, X } from "lucide-react"
import { useTheme } from "@/components/ThemeProvider"
import { cn } from "@/lib/utils"

export type SerializedStorefrontMessage = {
    id: string
    conversationId: string
    content: string
    createdAt: string
    senderType: "CUSTOMER" | "AI"
}

export type SerializedConversationCard = {
    id: string
    visitorId: string
    customerEmail: string | null
    updatedAt: string
    messages: SerializedStorefrontMessage[]
}

function shortVisitorLabel(visitorId: string): string {
    const v = visitorId.trim()
    if (v.length <= 14) return v
    return `${v.slice(0, 8)}…${v.slice(-4)}`
}

export default function StorefrontChatInboxClient({ cards }: { cards: SerializedConversationCard[] }) {
    const { theme } = useTheme()
    const isLight = theme === "light"
    const [openId, setOpenId] = useState<string | null>(null)
    const open = openId ? cards.find((c) => c.id === openId) : null

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpenId(null)
        }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [])

    useEffect(() => {
        if (openId) {
            const prev = document.body.style.overflow
            document.body.style.overflow = "hidden"
            return () => {
                document.body.style.overflow = prev
            }
        }
    }, [openId])

    return (
        <>
            <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                    <p
                        className={cn(
                            "text-sm font-black",
                            isLight ? "text-slate-900" : "text-white",
                        )}
                    >
                        Conversations
                    </p>
                    <p className={cn("text-xs", isLight ? "text-slate-500" : "text-slate-400")}>
                        Read-only · click a card to open
                    </p>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
                    {cards.map((card) => {
                        const thread = card.messages
                        const last = thread[thread.length - 1]
                        const snippet =
                            last?.content?.trim().slice(0, 160) ||
                            (thread.length === 0 ? "No messages in this session." : "")
                        const nCustomer = thread.filter((m) => m.senderType === "CUSTOMER").length
                        const nAi = thread.filter((m) => m.senderType === "AI").length

                        return (
                            <div
                                key={card.id}
                                role="button"
                                tabIndex={0}
                                onClick={() => setOpenId(card.id)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault()
                                        setOpenId(card.id)
                                    }
                                }}
                                className={cn(
                                    "rounded-xl border p-5 transition-all cursor-pointer group relative outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40",
                                    isLight
                                        ? "bg-white border-slate-200 shadow-sm hover:bg-slate-50 hover:border-indigo-300"
                                        : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-indigo-500/30",
                                )}
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <div
                                            className={cn(
                                                "w-10 h-10 rounded-lg border flex items-center justify-center shrink-0 transition-all",
                                                isLight
                                                    ? "bg-indigo-50 border-indigo-200 text-indigo-600 group-hover:bg-indigo-100"
                                                    : "bg-indigo-500/20 border-indigo-400/20 text-indigo-400 group-hover:bg-indigo-500/30",
                                            )}
                                        >
                                            <MessageCircle className="w-5 h-5" aria-hidden />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3
                                                className={cn(
                                                    "font-black text-base font-mono tracking-tight truncate",
                                                    isLight ? "text-slate-900" : "text-white",
                                                )}
                                                title={card.visitorId}
                                            >
                                                {shortVisitorLabel(card.visitorId)}
                                            </h3>
                                            {card.customerEmail ? (
                                                <p
                                                    className={cn(
                                                        "text-[11px] mt-0.5 truncate",
                                                        isLight ? "text-slate-600" : "text-slate-400",
                                                    )}
                                                >
                                                    {card.customerEmail}
                                                </p>
                                            ) : (
                                                <p
                                                    className={cn(
                                                        "text-[11px] mt-0.5",
                                                        isLight ? "text-slate-500" : "text-slate-500",
                                                    )}
                                                >
                                                    No email yet
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <span
                                        className={cn(
                                            "p-2 rounded-lg transition-colors shrink-0 pointer-events-none",
                                            isLight
                                                ? "text-slate-400 group-hover:text-indigo-600"
                                                : "text-slate-400 group-hover:text-indigo-400",
                                        )}
                                    >
                                        <MoreHorizontal className="w-4 h-4" aria-hidden />
                                    </span>
                                </div>

                                <div className="mb-4">
                                    <p
                                        className={cn(
                                            "text-xs line-clamp-3",
                                            isLight ? "text-slate-600" : "text-slate-300",
                                        )}
                                    >
                                        {snippet}
                                    </p>
                                </div>

                                <div className="flex items-center justify-between gap-2 text-xs flex-wrap">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span
                                            className={cn(
                                                "px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border",
                                                isLight
                                                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                                    : "bg-emerald-500/15 text-emerald-300 border-emerald-400/25",
                                            )}
                                        >
                                            {nCustomer} customer
                                        </span>
                                        <span
                                            className={cn(
                                                "px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border",
                                                isLight
                                                    ? "bg-indigo-50 text-indigo-800 border-indigo-200"
                                                    : "bg-indigo-500/15 text-indigo-300 border-indigo-400/25",
                                            )}
                                        >
                                            {nAi} AI
                                        </span>
                                        <span
                                            className={cn(
                                                "px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border",
                                                isLight
                                                    ? "bg-slate-100 text-slate-700 border-slate-200"
                                                    : "bg-white/5 text-slate-300 border-white/10",
                                            )}
                                        >
                                            {thread.length} messages
                                        </span>
                                    </div>
                                    <div
                                        className={cn(
                                            "text-right text-[11px] shrink-0",
                                            isLight ? "text-slate-500" : "text-slate-500",
                                        )}
                                    >
                                        <p>Updated {new Date(card.updatedAt).toLocaleString()}</p>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {open ? (
                <div className="fixed inset-0 z-[200]" role="presentation">
                    <button
                        type="button"
                        className={cn(
                            "absolute inset-0 backdrop-blur-sm border-0 cursor-default w-full h-full",
                            isLight ? "bg-slate-900/25" : "bg-black/60",
                        )}
                        aria-label="Close conversation"
                        onClick={() => setOpenId(null)}
                    />
                    <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
                        <div
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="storefront-chat-dialog-title"
                            className={cn(
                                "pointer-events-auto w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden",
                                isLight
                                    ? "bg-white border-slate-200 text-slate-900"
                                    : "bg-slate-900 border-white/10 text-white",
                            )}
                        >
                            <div
                                className={cn(
                                    "flex items-start justify-between gap-4 p-5 border-b shrink-0",
                                    isLight ? "border-slate-200" : "border-white/10",
                                )}
                            >
                                <div className="min-w-0 flex-1">
                                    <h2
                                        id="storefront-chat-dialog-title"
                                        className={cn(
                                            "text-lg font-black font-mono tracking-tight truncate",
                                            isLight ? "text-slate-900" : "text-white",
                                        )}
                                        title={open.visitorId}
                                    >
                                        {shortVisitorLabel(open.visitorId)}
                                    </h2>
                                    {open.customerEmail ? (
                                        <p
                                            className={cn(
                                                "text-sm mt-1 truncate",
                                                isLight ? "text-slate-600" : "text-slate-400",
                                            )}
                                        >
                                            {open.customerEmail}
                                        </p>
                                    ) : (
                                        <p
                                            className={cn(
                                                "text-sm mt-1",
                                                isLight ? "text-slate-500" : "text-slate-500",
                                            )}
                                        >
                                            No email on file
                                        </p>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setOpenId(null)}
                                    className={cn(
                                        "p-2 rounded-xl transition-colors shrink-0",
                                        isLight
                                            ? "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                                            : "text-slate-400 hover:text-white hover:bg-white/10",
                                    )}
                                    aria-label="Close"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
                                {open.messages.length === 0 ? (
                                    <p
                                        className={cn(
                                            "text-sm text-center py-8",
                                            isLight ? "text-slate-500" : "text-slate-500",
                                        )}
                                    >
                                        No messages in this thread.
                                    </p>
                                ) : (
                                    open.messages.map((m) => (
                                        <div key={m.id} className="flex flex-col gap-1.5">
                                            <div className="flex items-center justify-between gap-2">
                                                <span
                                                    className={cn(
                                                        "text-[10px] font-black uppercase tracking-widest rounded-full px-2 py-0.5 border shrink-0",
                                                        m.senderType === "AI"
                                                            ? isLight
                                                                ? "text-indigo-800 border-indigo-200 bg-indigo-50"
                                                                : "text-indigo-300 border-indigo-400/30 bg-indigo-500/10"
                                                            : isLight
                                                              ? "text-emerald-800 border-emerald-200 bg-emerald-50"
                                                              : "text-emerald-300 border-emerald-400/30 bg-emerald-500/10",
                                                    )}
                                                >
                                                    {m.senderType === "CUSTOMER" ? "Customer" : "AI"}
                                                </span>
                                                <span
                                                    className={cn(
                                                        "text-[11px] tabular-nums",
                                                        isLight ? "text-slate-500" : "text-slate-500",
                                                    )}
                                                >
                                                    {new Date(m.createdAt).toLocaleString()}
                                                </span>
                                            </div>
                                            <div
                                                className={cn(
                                                    "whitespace-pre-wrap text-sm rounded-xl px-4 py-3 border",
                                                    isLight
                                                        ? "text-slate-800 bg-slate-50 border-slate-200"
                                                        : "text-white/90 bg-black/30 border-white/10",
                                                )}
                                            >
                                                {m.content}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}
        </>
    )
}
