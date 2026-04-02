"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { MessageSquare, Send, X } from "lucide-react"

type StorefrontConfig = { enabled: boolean }

type WidgetMessage = {
    id: string
    content: string
    createdAt: string
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

    const [config, setConfig] = useState<StorefrontConfig>({ enabled: false })
    const [configLoading, setConfigLoading] = useState(true)
    const [configError, setConfigError] = useState<string | null>(null)

    const [isOpen, setIsOpen] = useState(false)
    const [visitorId, setVisitorId] = useState<string>("")

    const [messages, setMessages] = useState<WidgetMessage[]>([])
    const [composer, setComposer] = useState("")
    const [sending, setSending] = useState(false)
    const [sendError, setSendError] = useState<string | null>(null)

    const composerRef = useRef<HTMLTextAreaElement | null>(null)
    const messagesEndRef = useRef<HTMLDivElement | null>(null)

    const apiShopEncoded = useMemo(() => encodeURIComponent(shop), [shop])

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
        if (!shop) {
            setConfigLoading(false)
            setConfigError("Missing shop parameter")
            return
        }

        let cancelled = false
        const run = async () => {
            try {
                setConfigLoading(true)
                setConfigError(null)
                const res = await fetch(`/api/storefront-chat/config?shop=${apiShopEncoded}`)
                const data = (await res.json().catch(() => ({}))) as Partial<StorefrontConfig> & { message?: string }
                if (!res.ok) {
                    throw new Error(data.message || "Failed to fetch config")
                }
                if (!cancelled) {
                    setConfig({ enabled: !!data.enabled })
                }
            } catch (e: any) {
                if (!cancelled) {
                    setConfigError(e?.message || "Failed to load storefront chat config")
                    setConfig({ enabled: false })
                }
            } finally {
                if (!cancelled) setConfigLoading(false)
            }
        }

        run()
        return () => {
            cancelled = true
        }
    }, [shop, apiShopEncoded])

    useEffect(() => {
        if (!isOpen) return
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") setIsOpen(false)
        }
        window.addEventListener("keydown", onKeyDown)
        return () => window.removeEventListener("keydown", onKeyDown)
    }, [isOpen])

    useEffect(() => {
        if (!isOpen) return
        const prevOverflow = document.body.style.overflow
        document.body.style.overflow = "hidden"
        return () => {
            document.body.style.overflow = prevOverflow
        }
    }, [isOpen])

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [messages, isOpen])

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

            setMessages(prev => [
                ...prev,
                {
                    id: data?.message?.id || `local_${Date.now()}`,
                    content: text,
                    createdAt: new Date().toISOString()
                }
            ])
            setComposer("")
            setTimeout(() => composerRef.current?.focus(), 0)
        } catch (e: any) {
            setSendError(e?.message || "Failed to send message")
        } finally {
            setSending(false)
        }
    }

    // Widget is only visible if enabled for this store.
    if (configLoading || !config.enabled) {
        return null
    }

    return (
        <div className="w-full h-full relative">
            {!isOpen ? (
                <button
                    type="button"
                    onClick={() => setIsOpen(true)}
                    className="absolute bottom-5 right-5 z-[9999] w-14 h-14 rounded-2xl bg-indigo-600 shadow-xl hover:bg-indigo-700 transition-all flex items-center justify-center text-white"
                    aria-label="Open chat"
                >
                    <MessageSquare className="w-6 h-6" />
                </button>
            ) : (
                <div className="fixed inset-0 z-[9999]">
                    {/* Backdrop + centering */}
                    <div
                        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
                        onClick={() => setIsOpen(false)}
                        aria-hidden="true"
                    />

                    <div
                        className="absolute bottom-6 right-6 w-[360px] max-w-[calc(100vw-24px)] h-[520px] max-h-[calc(100vh-24px)] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
                        role="dialog"
                        aria-label="Chat widget"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-4 border-b flex items-center justify-between flex-shrink-0">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/20 flex items-center justify-center text-indigo-700">
                                    <MessageSquare className="w-5 h-5" />
                                </div>
                                <div className="min-w-0">
                                    <p className="font-black text-sm truncate">JUNO Chat</p>
                                    <p className="text-[11px] text-slate-500">Ask about products</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                className="w-9 h-9 rounded-xl hover:bg-slate-100 border border-slate-200 flex items-center justify-center"
                                aria-label="Close chat"
                            >
                                <X className="w-4 h-4 text-slate-600" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 bg-gradient-to-b from-white to-slate-50">
                            {sendError ? (
                                <div className="mb-3 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 text-xs font-medium">
                                    {sendError}
                                </div>
                            ) : null}

                            {messages.length === 0 ? (
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
                                        <div key={m.id} className="flex justify-end">
                                            <div className="max-w-[85%] px-3 py-2 rounded-2xl bg-indigo-600 text-white text-sm font-medium">
                                                {m.content}
                                            </div>
                                        </div>
                                    ))}
                                    <div ref={messagesEndRef} />
                                </div>
                            )}
                        </div>

                        <div className="p-4 border-t bg-white flex-shrink-0">
                            <div className="flex items-end gap-3">
                                <textarea
                                    ref={composerRef}
                                    rows={1}
                                    value={composer}
                                    onChange={(e) => setComposer(e.target.value)}
                                    placeholder="Type a message..."
                                    className="flex-1 resize-none border rounded-2xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/30"
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
                                    className="w-11 h-11 rounded-2xl bg-indigo-600 text-white shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-all"
                                    aria-label="Send message"
                                >
                                    <Send className="w-4 h-4" />
                                </button>
                            </div>
                            {configError ? (
                                <p className="mt-2 text-[11px] text-slate-500">{configError}</p>
                            ) : (
                                <p className="mt-2 text-[11px] text-slate-500">
                                    Customer messages are saved now. AI replies later.
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

