"use client"

import { useEffect, useRef, useState } from "react"
import { formatDistanceToNow } from "date-fns"
import { Send } from "lucide-react"

type WidgetMessage = {
    id: string
    content: string
    createdAt: string
    senderType: "CUSTOMER" | "AI"
    actions?: WidgetAction[]
}

type WidgetActionProduct = {
    productId: string
    title: string
    variantId?: string
    variantTitle?: string | null
    sku?: string | null
    price?: string | null
    imageUrl?: string | null
    productType?: string | null
    quantity?: number
}

type WidgetAction =
    | {
          type: "add_to_cart"
          label: string
          source?: "primary" | "upsell"
          product: WidgetActionProduct
      }
    | {
          type: "upsell_suggestion"
          label: string
          message: string
          product: WidgetActionProduct
      }
    | {
          type: "open_cart"
          label: string
          cartUrl: string
          product?: WidgetActionProduct
      }

type WidgetPostAction = {
    type: "add_to_cart" | "upsell_suggestion"
    productId: string
    variantId?: string
    quantity?: number
    sourceMessageId?: string
}

function isLikelyHttpUrl(value: string) {
    return /^https?:\/\/[^\s)]+$/i.test(value.trim())
}

function renderMessageContent(content: string) {
    // Supports both markdown links: [label](https://...)
    // and plain URLs in free text.
    const markdownOrUrl = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s)]+)/gi
    const nodes: Array<React.ReactNode> = []
    let lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = markdownOrUrl.exec(content)) !== null) {
        const [full] = match
        const start = match.index
        const end = start + full.length

        if (start > lastIndex) {
            nodes.push(content.slice(lastIndex, start))
        }

        const markdownLabel = match[1]
        const markdownUrl = match[2]
        const plainUrl = match[3]
        const href = markdownUrl || plainUrl || ""

        if (isLikelyHttpUrl(href)) {
            nodes.push(
                <a
                    key={`${start}-${href}`}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2 break-all text-indigo-600 hover:text-indigo-700"
                >
                    {markdownLabel || href}
                </a>
            )
        } else {
            nodes.push(full)
        }

        lastIndex = end
    }

    if (lastIndex < content.length) {
        nodes.push(content.slice(lastIndex))
    }

    return nodes
}

function normalizeWidgetActions(raw: unknown): WidgetAction[] {
    if (!Array.isArray(raw)) return []
    return raw.filter((action): action is WidgetAction => {
        if (!action || typeof action !== "object" || Array.isArray(action)) return false
        const item = action as { type?: unknown; product?: unknown; cartUrl?: unknown }
        if (item.type === "open_cart") return typeof item.cartUrl === "string"
        if (item.type === "add_to_cart" || item.type === "upsell_suggestion") {
            return Boolean(item.product && typeof item.product === "object")
        }
        return false
    })
}

function apiErrorMessage(raw: unknown, fallback: string) {
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        const message = (raw as { message?: unknown }).message
        if (typeof message === "string" && message.trim()) return message
    }
    return fallback
}

function apiMessages(raw: unknown): unknown[] {
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        const messages = (raw as { messages?: unknown }).messages
        return Array.isArray(messages) ? messages : []
    }
    return []
}

function toWidgetMessage(raw: unknown, fallbackId?: string): WidgetMessage {
    const message = raw && typeof raw === "object" && !Array.isArray(raw)
        ? raw as Record<string, unknown>
        : {}
    return {
        id: String(message.id || fallbackId || `local_${Date.now()}`),
        content: String(message.content || ""),
        senderType: (message.senderType === "AI" ? "AI" : "CUSTOMER") as "AI" | "CUSTOMER",
        createdAt: String(message.createdAt || new Date().toISOString()),
        actions: normalizeWidgetActions(message.actions),
    }
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
    const [aiTyping, setAiTyping] = useState(false)

    const [verifyEmail, setVerifyEmail] = useState("")
    const [otpCode, setOtpCode] = useState("")
    const [otpSending, setOtpSending] = useState(false)
    const [otpBusy, setOtpBusy] = useState(false)
    const [otpMessage, setOtpMessage] = useState<string | null>(null)
    const [sessionUntil, setSessionUntil] = useState<string | null>(null)
    /** collect_email → enter_code (after send) → verified */
    const [otpPhase, setOtpPhase] = useState<"collect_email" | "enter_code" | "verified">(
        "collect_email",
    )

    const composerRef = useRef<HTMLTextAreaElement | null>(null)
    const messagesEndRef = useRef<HTMLDivElement | null>(null)
    const messagesScrollRef = useRef<HTMLDivElement | null>(null)
    const otpInputRef = useRef<HTMLInputElement | null>(null)

    useEffect(() => {
        // Embedded in a storefront iframe: one scroll surface only (the message list).
        // If html/body can scroll, the wheel often moves the page scrollbar instead of chat.
        const html = document.documentElement
        const body = document.body
        const prevHtmlBg = html.style.backgroundColor
        const prevBodyBg = body.style.backgroundColor
        const prevBodyMargin = body.style.margin
        const prevBodyMinHeight = body.style.minHeight
        const prevHtmlH = html.style.height
        const prevHtmlOverflow = html.style.overflow
        const prevBodyH = body.style.height
        const prevBodyOverflow = body.style.overflow

        html.style.backgroundColor = "#ffffff"
        body.style.backgroundColor = "#ffffff"
        body.style.margin = "0"
        html.style.height = "100%"
        html.style.overflow = "hidden"
        body.style.height = "100%"
        body.style.minHeight = "100%"
        body.style.overflow = "hidden"

        return () => {
            html.style.backgroundColor = prevHtmlBg
            body.style.backgroundColor = prevBodyBg
            body.style.margin = prevBodyMargin
            body.style.minHeight = prevBodyMinHeight
            html.style.height = prevHtmlH
            html.style.overflow = prevHtmlOverflow
            body.style.height = prevBodyH
            body.style.overflow = prevBodyOverflow
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
                    throw new Error(apiErrorMessage(data, "Failed to load history"))
                }
                const nextMessages = apiMessages(data)
                if (!cancelled) {
                    setMessages(nextMessages.map((m) => toWidgetMessage(m)))
                }
            } catch (e: unknown) {
                if (!cancelled) {
                    setSendError(e instanceof Error ? e.message : "Failed to load chat history")
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
        const el = messagesScrollRef.current
        if (el) {
            el.scrollTop = el.scrollHeight
        } else {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
        }
    }, [messages])

    useEffect(() => {
        if (otpPhase === "enter_code") {
            setTimeout(() => otpInputRef.current?.focus(), 0)
        }
    }, [otpPhase])

    /** Parent storefront often receives wheel events before the iframe; capture + stop on the chat scroller. */
    useEffect(() => {
        if (!shop) return
        const el = messagesScrollRef.current
        if (!el) return
        const stopWheelBubble = (e: WheelEvent) => {
            e.stopPropagation()
        }
        el.addEventListener("wheel", stopWheelBubble, { capture: true })
        return () => el.removeEventListener("wheel", stopWheelBubble, { capture: true })
    }, [shop, messages.length])

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
            setOtpCode("")
            setOtpPhase("enter_code")
            setOtpMessage(null)
        } catch (e: unknown) {
            setOtpMessage(e instanceof Error ? e.message : "Failed to send code")
        } finally {
            setOtpSending(false)
        }
    }

    const backToEmailStep = () => {
        setOtpPhase("collect_email")
        setOtpCode("")
        setOtpMessage(null)
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
            const expiresRaw =
                typeof data.sessionExpiresAt === "string" ? data.sessionExpiresAt : null
            setSessionUntil(expiresRaw)
            setOtpCode("")
            setOtpPhase("verified")
            const expiresAt = expiresRaw ? new Date(expiresRaw) : null
            const distanceOk =
                expiresAt && !Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() > Date.now()
            setOtpMessage(
                distanceOk
                    ? `You’re verified. This session stays active ${formatDistanceToNow(expiresAt!, { addSuffix: true })}. You can ask about your orders until then.`
                    : "You’re verified. You can ask about your orders until this session expires.",
            )
        } catch (e: unknown) {
            setOtpMessage(e instanceof Error ? e.message : "Verification failed")
        } finally {
            setOtpBusy(false)
        }
    }

    const send = async (postAction?: WidgetPostAction, actionLabel?: string) => {
        if (!shop || !visitorId) return
        const text = postAction ? actionLabel || "Add to cart" : composer.trim()
        if (!text && !postAction) return
        const typingStartedAt = Date.now()

        const optimisticCustomerMessage: WidgetMessage = {
            id: `local_customer_${Date.now()}`,
            content: text,
            senderType: "CUSTOMER",
            createdAt: new Date().toISOString(),
        }

        setMessages((prev) => [...prev, optimisticCustomerMessage])
        if (!postAction) {
            setComposer("")
        }
        setAiTyping(true)
        setTimeout(() => composerRef.current?.focus(), 0)

        try {
            setSendError(null)
            setSending(true)
            const res = await fetch("/api/storefront-chat/messages", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ shop, visitorId, content: text, action: postAction })
            })

            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                throw new Error(apiErrorMessage(data, "Failed to send message"))
            }

            const returned = apiMessages(data)
            if (returned.length) {
                const returnedTyped = returned.map((m) => toWidgetMessage(m))
                const aiReplies = returnedTyped.filter((m: WidgetMessage) => m.senderType === "AI")
                const elapsed = Date.now() - typingStartedAt
                const minTypingMs = 1000
                if (elapsed < minTypingMs) {
                    await new Promise((resolve) => setTimeout(resolve, minTypingMs - elapsed))
                }
                setMessages(prev => [...prev, ...aiReplies])
            }
        } catch (e: unknown) {
            setSendError(e instanceof Error ? e.message : "Failed to send message")
            setMessages((prev) => prev.filter((m) => m.id !== optimisticCustomerMessage.id))
        } finally {
            setAiTyping(false)
            setSending(false)
        }
    }

    const submitCartAction = (message: WidgetMessage, action: Extract<WidgetAction, { type: "add_to_cart" | "upsell_suggestion" }>) => {
        void send(
            {
                type: action.type,
                productId: action.product.productId,
                variantId: action.product.variantId,
                quantity: action.product.quantity ?? 1,
                sourceMessageId: message.id,
            },
            action.label,
        )
    }

    const reportWidgetEvent = (message: WidgetMessage, action: Extract<WidgetAction, { type: "open_cart" }>) => {
        if (!shop || !visitorId) return
        const payload = JSON.stringify({
            shop,
            visitorId,
            type: "cart_link_opened",
            productId: action.product?.productId,
            variantId: action.product?.variantId,
            sourceMessageId: message.id,
        })
        try {
            if (navigator.sendBeacon) {
                navigator.sendBeacon("/api/storefront-chat/events", new Blob([payload], { type: "application/json" }))
                return
            }
        } catch {
            /* ignore and fallback */
        }
        void fetch("/api/storefront-chat/events", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: payload,
            keepalive: true,
        }).catch(() => {})
    }

    const renderMessageActions = (message: WidgetMessage) => {
        if (message.senderType !== "AI" || !message.actions?.length) return null

        return (
            <div className="mt-2 space-y-2">
                {message.actions.map((action, index) => {
                    if (action.type === "open_cart") {
                        return (
                            <button
                                key={`${message.id}-${action.type}-${index}`}
                                type="button"
                                onClick={() => {
                                    reportWidgetEvent(message, action)
                                    window.open(action.cartUrl, "_blank", "noopener,noreferrer")
                                }}
                                className="w-full rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-left text-xs font-bold text-emerald-800 hover:bg-emerald-100"
                            >
                                {action.label}
                            </button>
                        )
                    }

                    if (action.type === "upsell_suggestion") {
                        return (
                            <div
                                key={`${message.id}-${action.type}-${index}`}
                                className="rounded-xl border border-indigo-100 bg-indigo-50/70 p-2"
                            >
                                <div className="flex gap-2">
                                    {action.product.imageUrl ? (
                                        <span
                                            aria-hidden="true"
                                            className="h-12 w-12 flex-shrink-0 rounded-lg bg-slate-100 bg-cover bg-center"
                                            style={{ backgroundImage: `url(${action.product.imageUrl})` }}
                                        />
                                    ) : null}
                                    <div className="min-w-0 flex-1">
                                        <p className="text-xs font-semibold text-slate-800">
                                            {action.message}
                                        </p>
                                        {action.product.price ? (
                                            <p className="mt-0.5 text-[11px] text-slate-500">
                                                {action.product.price}
                                            </p>
                                        ) : null}
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => submitCartAction(message, action)}
                                    disabled={sending}
                                    className="mt-2 w-full rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                                >
                                    {action.label}
                                </button>
                            </div>
                        )
                    }

                    return (
                        <button
                            key={`${message.id}-${action.type}-${index}`}
                            type="button"
                            onClick={() => submitCartAction(message, action)}
                            disabled={sending}
                            className="w-full rounded-xl border border-indigo-200 bg-white px-3 py-2 text-left hover:bg-indigo-50 disabled:opacity-50"
                        >
                            <span className="flex items-center gap-2">
                                {action.product.imageUrl ? (
                                    <span
                                        aria-hidden="true"
                                        className="h-10 w-10 flex-shrink-0 rounded-lg bg-slate-100 bg-cover bg-center"
                                        style={{ backgroundImage: `url(${action.product.imageUrl})` }}
                                    />
                                ) : null}
                                <span className="min-w-0">
                                    <span className="block text-xs font-bold text-indigo-700">
                                        {action.label}
                                    </span>
                                    <span className="block truncate text-[11px] font-medium text-slate-500">
                                        {action.product.title}
                                    </span>
                                    {action.product.price ? (
                                        <span className="block text-[11px] font-medium text-slate-400">
                                            {action.product.price}
                                        </span>
                                    ) : null}
                                </span>
                            </span>
                        </button>
                    )
                })}
            </div>
        )
    }

    // Require shop context; otherwise render nothing.
    if (!shop) {
        return null
    }

    return (
        <div className="fixed inset-0 z-0 flex min-h-0 w-full flex-col overflow-hidden bg-white text-slate-900">
            <div
                ref={messagesScrollRef}
                tabIndex={0}
                className="min-h-0 flex-1 touch-pan-y overflow-y-auto overflow-x-hidden overscroll-y-contain p-4 bg-gradient-to-b from-white to-slate-50 [scrollbar-gutter:stable] outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/40"
                style={{ WebkitOverflowScrolling: "touch" }}
            >
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
                                <div className="max-w-[88%]">
                                    <div
                                        className={`px-3 py-2 rounded-2xl text-sm font-medium whitespace-pre-wrap ${
                                            m.senderType === "AI"
                                                ? "bg-white border border-slate-200 text-slate-800"
                                                : "bg-indigo-600 text-white"
                                        }`}
                                    >
                                        {renderMessageContent(m.content)}
                                    </div>
                                    {renderMessageActions(m)}
                                </div>
                            </div>
                        ))}
                        {aiTyping ? (
                            <div className="flex justify-start">
                                <div className="max-w-[88%] px-3 py-3 rounded-2xl bg-white border border-slate-200">
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.2s]" />
                                        <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.1s]" />
                                        <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" />
                                    </div>
                                </div>
                            </div>
                        ) : null}
                        <div ref={messagesEndRef} />
                    </div>
                )}
            </div>

            <div className="flex-shrink-0 space-y-3 border-t border-slate-200 bg-white p-3">
                <details className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2">
                    <summary className="cursor-pointer text-xs font-bold text-slate-700">
                        Order help — verify your email
                    </summary>
                    <div className="mt-2 space-y-3">
                        {otpPhase === "verified" ? (
                            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                                <p className="text-xs font-bold text-emerald-900">Email verified</p>
                                <p className="mt-1 text-[11px] text-emerald-800">{otpMessage}</p>
                                {sessionUntil ? (
                                    <p className="mt-2 text-[10px] text-emerald-700/90">
                                        Session active until{" "}
                                        <span className="font-semibold">
                                            {new Date(sessionUntil).toLocaleString()}
                                        </span>
                                    </p>
                                ) : null}
                            </div>
                        ) : (
                            <>
                                {otpPhase === "collect_email" ? (
                                    <>
                                        <p className="text-[11px] text-slate-500">
                                            For order status and account-specific questions, enter the
                                            email you used at checkout. We&apos;ll send a one-time code.
                                        </p>
                                        <input
                                            type="email"
                                            value={verifyEmail}
                                            onChange={(e) => setVerifyEmail(e.target.value)}
                                            placeholder="you@example.com"
                                            autoComplete="email"
                                            className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => void sendOtp()}
                                            disabled={otpSending}
                                            className="w-full rounded-lg bg-slate-800 px-3 py-2 text-xs font-bold text-white disabled:opacity-50 sm:w-auto"
                                        >
                                            {otpSending ? "Sending…" : "Send code"}
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <div
                                            role="status"
                                            className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-[11px] text-indigo-900"
                                        >
                                            <p className="font-bold">Code sent</p>
                                            <p className="mt-1 text-indigo-800">
                                                We emailed a 6-digit code to{" "}
                                                <span className="font-semibold break-all">
                                                    {verifyEmail.trim()}
                                                </span>
                                                . Enter it below (check spam).
                                            </p>
                                            <button
                                                type="button"
                                                onClick={backToEmailStep}
                                                className="mt-2 text-[11px] font-bold text-indigo-700 underline decoration-indigo-300 underline-offset-2 hover:text-indigo-900"
                                            >
                                                Wrong email? Start over
                                            </button>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <label className="sr-only">Verification code</label>
                                            <input
                                                ref={otpInputRef}
                                                type="text"
                                                inputMode="numeric"
                                                autoComplete="one-time-code"
                                                maxLength={6}
                                                value={otpCode}
                                                onChange={(e) =>
                                                    setOtpCode(
                                                        e.target.value.replace(/\D/g, "").slice(0, 6),
                                                    )
                                                }
                                                placeholder="000000"
                                                className="w-32 rounded-lg border border-slate-200 px-2 py-2 text-sm font-semibold tracking-[0.2em]"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => void verifyOtp()}
                                                disabled={otpBusy}
                                                className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
                                            >
                                                {otpBusy ? "Verifying…" : "Verify"}
                                            </button>
                                        </div>
                                    </>
                                )}
                                {otpMessage ? (
                                    <p
                                        role="alert"
                                        className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-900"
                                    >
                                        {otpMessage}
                                    </p>
                                ) : null}
                            </>
                        )}
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

