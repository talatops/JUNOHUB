"use client"

import { useEffect, useRef, useState } from "react"
import { Send } from "lucide-react"

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

    const [verifyEmail, setVerifyEmail] = useState("")
    const [otpCode, setOtpCode] = useState("")
    const [otpSending, setOtpSending] = useState(false)
    const [otpBusy, setOtpBusy] = useState(false)
    const [otpMessage, setOtpMessage] = useState<string | null>(null)
    const [sessionUntil, setSessionUntil] = useState<string | null>(null)

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

    const sendOtp = async () => {
        if (!shop || !visitorId) return
        const email = verifyEmail.trim()
        if (!email) {
            setOtpMessage("Enter your email first.")
            return
        }
        try {
            setOtpMessage(null)
            setOtpSending(true)
            const res = await fetch("/api/storefront-chat/otp/request", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ shop, visitorId, email }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                throw new Error(data?.message || "Could not send code")
            }
            setOtpMessage("Check your inbox for a 6-digit code.")
        } catch (e: unknown) {
            setOtpMessage(e instanceof Error ? e.message : "Failed to send code")
        } finally {
            setOtpSending(false)
        }
    }

    const verifyOtp = async () => {
        if (!shop || !visitorId) return
        const email = verifyEmail.trim()
        const code = otpCode.trim()
        if (!email || !/^\d{6}$/.test(code)) {
            setOtpMessage("Enter email and 6-digit code.")
            return
        }
        try {
            setOtpMessage(null)
            setOtpBusy(true)
            const res = await fetch("/api/storefront-chat/otp/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ shop, visitorId, email, code }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                throw new Error(data?.message || "Invalid code")
            }
            setSessionUntil(
                typeof data.sessionExpiresAt === "string" ? data.sessionExpiresAt : null,
            )
            setOtpCode("")
            setOtpMessage("Verified. You can ask about your orders for about one hour.")
        } catch (e: unknown) {
            setOtpMessage(e instanceof Error ? e.message : "Verification failed")
        } finally {
            setOtpBusy(false)
        }
    }

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

            <div className="p-3 border-t border-slate-200 bg-white flex-shrink-0 space-y-3">
                <details className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2">
                    <summary className="cursor-pointer text-xs font-bold text-slate-700">
                        Order help — verify your email
                    </summary>
                    <div className="mt-2 space-y-2">
                        <p className="text-[11px] text-slate-500">
                            For order status and account-specific questions, enter the email you used
                            at checkout. We&apos;ll send a one-time code.
                        </p>
                        <input
                            type="email"
                            value={verifyEmail}
                            onChange={(e) => setVerifyEmail(e.target.value)}
                            placeholder="you@example.com"
                            className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm"
                        />
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => void sendOtp()}
                                disabled={otpSending}
                                className="text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-800 text-white disabled:opacity-50"
                            >
                                {otpSending ? "Sending…" : "Send code"}
                            </button>
                        </div>
                        <div className="flex gap-2 items-center">
                            <input
                                type="text"
                                inputMode="numeric"
                                maxLength={6}
                                value={otpCode}
                                onChange={(e) =>
                                    setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                                }
                                placeholder="000000"
                                className="w-28 border border-slate-200 rounded-lg px-2 py-1.5 text-sm tracking-widest"
                            />
                            <button
                                type="button"
                                onClick={() => void verifyOtp()}
                                disabled={otpBusy}
                                className="text-xs font-bold px-3 py-1.5 rounded-lg bg-indigo-600 text-white disabled:opacity-50"
                            >
                                {otpBusy ? "…" : "Verify"}
                            </button>
                        </div>
                        {otpMessage ? (
                            <p className="text-[11px] text-slate-600">{otpMessage}</p>
                        ) : null}
                        {sessionUntil ? (
                            <p className="text-[10px] text-slate-400">
                                Session active until {new Date(sessionUntil).toLocaleString()}
                            </p>
                        ) : null}
                    </div>
                </details>
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

