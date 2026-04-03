"use client"

import { useEffect, useRef, useState } from "react"
import { MessageSquare, Send } from "lucide-react"

type WidgetMessage = {
    id: string
    content: string
    createdAt: string
    senderType: "CUSTOMER" | "AI"
}

function getOrCreateVisitorId(shop: string) {
    const key = `juno_storefront_visitor_id_${shop}`
    try {
        const existing = localStorage.getItem(key)
        if (existing) return existing
        const id = crypto.randomUUID()
        localStorage.setItem(key, id)
        return id
    } catch {
        // Fallback if storage/crypto fails.
        return `visitor_${Math.random().toString(16).slice(2)}`
    }
}

export default function StorefrontChatWidgetPage() {
    const [shop, setShop] = useState<string>("")
    const [visitorId, setVisitorId] = useState<string>("")

    const [messages, setMessages] = useState<WidgetMessage[]>([])
    const [composer, setComposer] = useState("")
    const [sending, setSending] = useState(false)
    const [sendError, setSendError] = useState<string | null>(null)
    const [loadingHistory, setLoadingHistory] = useState(false)

    const composerRef = useRef<HTMLTextAreaElement | null>(null)
    const messagesEndRef = useRef<HTMLDivElement | null>(null)

    useEffect(() => {
        // This page is rendered inside a storefront iframe. Force a neutral
        // full-height canvas to avoid inheriting dark app-shell backgrounds.
        const html = document.documentElement
        const body = document.body
        const prevHtmlBg = html.style.backgroundColor
        const prevBodyBg = body.style.backgroundColor
        const prevBodyMargin = body.style.margin
        const prevBodyMinHeight = body.style.minHeight

        html.style.backgroundColor = "#ffffff"
        body.style.backgroundColor = "#ffffff"
        body.style.margin = "0"
        body.style.minHeight = "100vh"

        return () => {
            html.style.backgroundColor = prevHtmlBg
            body.style.backgroundColor = prevBodyBg
            body.style.margin = prevBodyMargin
            body.style.minHeight = prevBodyMinHeight
        }
    }, [])

    useEffect(() => {
        // Read query string on the client to avoid Next.js prerender warnings.
        try {
            const params = new URLSearchParams(window.location.search)
            const nextShop = params.get("shop")?.trim() || ""
            setShop(nextShop)
        } catch {
            setShop("")
        }
    }, [])

    useEffect(() => {
        if (!shop) return
        setVisitorId(getOrCreateVisitorId(shop))
    }, [shop])

    useEffect(() => {
        if (!shop || !visitorId) return
        let cancelled = false

        const run = async () => {
            try {
                setLoadingHistory(true)
                const res = await fetch(
                    `/api/storefront-chat/messages?shop=${encodeURIComponent(shop)}&visitorId=${encodeURIComponent(visitorId)}`
                )
                const data = await res.json().catch(() => ({}))
                if (!res.ok) {
                    throw new Error(data?.message || "Failed to load history")
                }
                const nextMessages = Array.isArray(data?.messages) ? data.messages : []
                if (!cancelled) {
                    setMessages(
                        nextMessages.map((m: any) => ({
                            id: String(m.id),
                            content: String(m.content || ""),
                            senderType: (m.senderType === "AI" ? "AI" : "CUSTOMER") as "AI" | "CUSTOMER",
                            createdAt: String(m.createdAt || new Date().toISOString())
                        }))
                    )
                }
            } catch (e: any) {
                if (!cancelled) {
                    setSendError(e?.message || "Failed to load chat history")
                }
            } finally {
                if (!cancelled) {
                    setLoadingHistory(false)
                }
            }
        }

        void run()
        return () => {
            cancelled = true
        }
    }, [shop, visitorId])

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [messages])

    const send = async () => {
        if (!shop || !visitorId) return
        const text = composer.trim()
        if (!text) return

        try {
            setSendError(null)
            setSending(true)
            const res = await fetch("/api/storefront-chat/messages", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ shop, visitorId, content: text })
            })

            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                throw new Error(data?.message || "Failed to send message")
            }

            const returned = Array.isArray(data?.messages) ? data.messages : []
            if (returned.length) {
                setMessages(prev => [
                    ...prev,
                    ...returned.map((m: any) => ({
                        id: String(m.id || `local_${Date.now()}`),
                        content: String(m.content || ""),
                        senderType: (m.senderType === "AI" ? "AI" : "CUSTOMER") as "AI" | "CUSTOMER",
                        createdAt: String(m.createdAt || new Date().toISOString())
                    }))
                ])
            } else {
                setMessages(prev => [
                    ...prev,
                    {
                        id: `local_${Date.now()}`,
                        content: text,
                        senderType: "CUSTOMER",
                        createdAt: new Date().toISOString()
                    }
                ])
            }
            setComposer("")
            setTimeout(() => composerRef.current?.focus(), 0)
        } catch (e: any) {
            setSendError(e?.message || "Failed to send message")
        } finally {
            setSending(false)
        }
    }

    // Require shop context; otherwise render nothing.
    if (!shop) {
        return null
    }

    return (
        <div className="w-screen h-screen overflow-hidden bg-white text-slate-900 flex flex-col">
            <div className="flex-1 overflow-y-auto p-4 bg-gradient-to-b from-white to-slate-50">
                {sendError ? (
                    <div className="mb-3 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 text-xs font-medium">
                        {sendError}
                    </div>
                ) : null}

                {loadingHistory ? (
                    <div className="h-full flex items-center justify-center text-center p-4">
                        <p className="text-sm font-medium text-slate-500">Loading chat...</p>
                    </div>
                ) : messages.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-center p-4">
                        <div>
                            <p className="font-black text-slate-900">Start a conversation</p>
                            <p className="text-xs text-slate-500 mt-1">
                                Send a message about any product on this store.
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {messages.map((m) => (
                            <div
                                key={m.id}
                                className={`flex ${m.senderType === "AI" ? "justify-start" : "justify-end"}`}
                            >
                                <div
                                    className={`max-w-[88%] px-3 py-2 rounded-2xl text-sm font-medium whitespace-pre-wrap ${
                                        m.senderType === "AI"
                                            ? "bg-white border border-slate-200 text-slate-800"
                                            : "bg-indigo-600 text-white"
                                    }`}
                                >
                                    {m.content}
                                </div>
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>
                )}
            </div>

            <div className="p-3 border-t border-slate-200 bg-white flex-shrink-0">
                <div className="flex items-end gap-2">
                    <textarea
                        ref={composerRef}
                        rows={1}
                        value={composer}
                        onChange={(e) => setComposer(e.target.value)}
                        placeholder="Type a message..."
                        className="flex-1 resize-none border border-slate-200 bg-white rounded-2xl px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-indigo-500/30"
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault()
                                void send()
                            }
                        }}
                    />
                    <button
                        type="button"
                        onClick={() => void send()}
                        disabled={sending || !composer.trim()}
                        className="w-11 h-11 rounded-2xl bg-indigo-600 text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-all"
                        aria-label="Send message"
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </div>
                <p className="mt-2 text-[11px] text-slate-500">AI replies are generated from products, FAQs and KB.</p>
            </div>
        </div>
    )
}

