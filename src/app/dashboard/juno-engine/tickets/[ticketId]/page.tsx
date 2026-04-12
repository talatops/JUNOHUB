"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeft,
  Ticket,
  Loader2,
  MessageCircleQuestion,
  Send,
  Sparkles,
} from "lucide-react"
import { cn } from "@/lib/utils"

type TicketStatus = "open" | "pending" | "resolved" | "closed"

interface TicketMessage {
  id: string
  subject: string
  bodyPreview: string | null
  status: string
  trigger: string | null
  sentAt: string
}

interface TicketData {
  id: string
  subject: string
  rootSubject: string
  customerEmail: string
  status: string
  updatedAt: string
  messagesCount: number
  lastMessageSnippet: string
  messages: TicketMessage[]
}

type AskSupplierPreviewGroup = {
  supplierUserId: string
  companyName: string
  lines: Array<{
    lineIndex: number
    title: string
    sku: string | null
    quantity: number
    shopifyProductId: string | null
  }>
}

type AskSupplierPreview = {
  order: { shopifyOrderId: string; orderNumber: string } | null
  groups: AskSupplierPreviewGroup[]
  message?: string
}

import { useTheme } from "@/components/ThemeProvider"

export default function TicketDetailPage() {
  const params = useParams<{ ticketId: string }>()
  const router = useRouter()
  const { theme } = useTheme()
  const isLight = theme === "light"
  const [ticket, setTicket] = useState<TicketData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedMessages, setExpandedMessages] = useState<Record<string, boolean>>({})

  const [orderRefInput, setOrderRefInput] = useState("")
  const [askPreviewLoading, setAskPreviewLoading] = useState(false)
  const [askPreview, setAskPreview] = useState<AskSupplierPreview | null>(null)
  const [askPreviewError, setAskPreviewError] = useState<string | null>(null)
  const [msgBySupplier, setMsgBySupplier] = useState<Record<string, string>>({})
  const [draftingSupplierId, setDraftingSupplierId] = useState<string | null>(null)
  const [sendingSupplierId, setSendingSupplierId] = useState<string | null>(null)

  useEffect(() => {
    const loadTicket = async () => {
      try {
        setLoading(true)
        setError(null)

        const res = await fetch("/api/juno-engine/tickets", {
          cache: "no-store",
        })
        if (!res.ok) {
          throw new Error("Failed to load ticket")
        }
        const data = (await res.json()) as { tickets: TicketData[] }
        const decodedId = decodeURIComponent(params.ticketId)
        const found = data.tickets.find((t) => t.id === decodedId) || null
        if (!found) {
          setError("Ticket not found.")
        } else {
          setTicket(found)
        }
      } catch (err) {
        console.error("Failed to load ticket", err)
        setError("Could not load this ticket. Please ensure your Gmail integration is connected.")
      } finally {
        setLoading(false)
      }
    }

    void loadTicket()
  }, [params.ticketId])

  const loadAskSupplierPreview = async () => {
    const ref = orderRefInput.trim()
    if (!ref) {
      setAskPreviewError("Enter an order number (e.g. 1002 or #1002).")
      return
    }
    setAskPreviewLoading(true)
    setAskPreviewError(null)
    try {
      const res = await fetch(
        `/api/juno-engine/tickets/ask-supplier?orderRef=${encodeURIComponent(ref)}`,
        { cache: "no-store" },
      )
      const data = (await res.json()) as AskSupplierPreview
      if (!res.ok) {
        throw new Error((data as { message?: string }).message || "Preview failed")
      }
      setAskPreview(data)
      if (!data.order) {
        setAskPreviewError(
          data.message ||
            "Order not found in cache. Sync orders or check the order number.",
        )
      } else if (data.groups.length === 0) {
        setAskPreviewError(
          "No suppliers linked for these line items. Ensure orders are synced and products are ACCEPTED with a connected supplier.",
        )
      } else {
        setAskPreviewError(null)
      }
    } catch (e) {
      setAskPreview(null)
      setAskPreviewError(e instanceof Error ? e.message : "Preview failed")
    } finally {
      setAskPreviewLoading(false)
    }
  }

  const draftForSupplier = async (supplierUserId: string) => {
    const ref = orderRefInput.trim()
    if (!ref || !ticket) return
    const snippet = [
      `Subject: ${ticket.subject}`,
      ticket.lastMessageSnippet ? `Latest: ${ticket.lastMessageSnippet}` : "",
    ]
      .filter(Boolean)
      .join("\n")
    setDraftingSupplierId(supplierUserId)
    try {
      const res = await fetch("/api/juno-engine/tickets/ask-supplier/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderRef: ref,
          supplierUserId,
          ticketSnippet: snippet.slice(0, 6000),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.message || "Draft failed")
      }
      setMsgBySupplier((prev) => ({
        ...prev,
        [supplierUserId]: typeof data.draft === "string" ? data.draft : "",
      }))
    } catch (e) {
      setAskPreviewError(e instanceof Error ? e.message : "Draft failed")
    } finally {
      setDraftingSupplierId(null)
    }
  }

  const sendToSupplier = async (supplierUserId: string) => {
    const ref = orderRefInput.trim()
    const text = (msgBySupplier[supplierUserId] || "").trim()
    if (!ref || !ticket || !text) {
      setAskPreviewError("Enter a message to send.")
      return
    }
    setSendingSupplierId(supplierUserId)
    setAskPreviewError(null)
    try {
      const res = await fetch("/api/juno-engine/tickets/ask-supplier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderRef: ref,
          ticketKey: ticket.id,
          supplierUserId,
          message: text,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.message || "Send failed")
      }
      setMsgBySupplier((prev) => ({ ...prev, [supplierUserId]: "" }))
    } catch (e) {
      setAskPreviewError(e instanceof Error ? e.message : "Send failed")
    } finally {
      setSendingSupplierId(null)
    }
  }

  const getStatusStyles = (status: TicketStatus | string) => {
    switch (status) {
      case "open":
        return isLight ? "bg-blue-100 text-blue-700 border-blue-200" : "bg-blue-500/20 text-blue-400 border-blue-500/20"
      case "pending":
        return isLight ? "bg-amber-100 text-amber-700 border-amber-200" : "bg-yellow-500/20 text-yellow-400 border-yellow-500/20"
      case "resolved":
        return isLight ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-emerald-500/20 text-emerald-400 border-emerald-500/20"
      case "closed":
        return isLight ? "bg-slate-100 text-slate-700 border-slate-200" : "bg-slate-500/20 text-slate-400 border-slate-500/20"
      default:
        return isLight ? "bg-slate-50 text-slate-600 border-slate-200" : "bg-white/10 text-slate-400 border-white/10"
    }
  }

  return (
    <div className={cn("h-full flex flex-col min-h-0", isLight ? "bg-slate-50/50" : "")}>
      <div className="w-full px-4 md:px-8 py-4 md:py-6 flex flex-col gap-6 min-h-0 h-full">
        {/* Header */}
        <div className="flex items-center gap-4 flex-shrink-0">
          <button
            onClick={() => router.push("/dashboard/juno-engine/tickets")}
            className={cn(
              "inline-flex items-center justify-center w-10 h-10 rounded-full border transition-all shadow-sm",
              isLight
                ? "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-indigo-600"
                : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
            )}
            title="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className={cn(
              "text-2xl md:text-3xl font-black tracking-tight truncate",
              isLight ? "text-slate-900" : "text-white"
            )}>
              {ticket?.subject || "Ticket"}
            </h1>
            <p className={cn(
              "text-sm mt-0.5 truncate font-medium",
              isLight ? "text-slate-500" : "text-slate-400"
            )}>
              {ticket?.customerEmail || "Full automated email history for this customer."}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
            <p className="font-medium animate-pulse">Loading ticket...</p>
          </div>
        ) : error || !ticket ? (
          <div className="flex-1 flex flex-col items-center justify-center text-red-400 gap-3 text-center px-4">
            <p className="font-medium">{error || "Ticket not found."}</p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0 gap-8">
            {/* Meta badges */}
            <div className="flex flex-wrap items-center justify-between gap-4 text-xs flex-shrink-0">
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={cn(
                    "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm border",
                    getStatusStyles(ticket.status as TicketStatus)
                  )}
                >
                  {ticket.status}
                </span>
                <span className={cn(
                  "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm border",
                  isLight
                    ? "bg-white border-slate-200 text-slate-600"
                    : "bg-white/5 border-white/10 text-slate-300"
                )}>
                  {ticket.messagesCount} messages
                </span>
              </div>
              <div className={cn(
                "text-[11px] font-bold",
                isLight ? "text-slate-400" : "text-slate-500"
              )}>
                Updated{" "}
                {new Date(ticket.updatedAt).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </div>
            </div>

            {/* Ask supplier (per supplier, optional) */}
            <div
              className={cn(
                "rounded-2xl border p-5 flex flex-col gap-4 flex-shrink-0",
                isLight ? "bg-white border-slate-200 shadow-sm" : "bg-white/5 border-white/10",
              )}
            >
              <div className="flex items-center gap-2">
                <MessageCircleQuestion
                  className={cn("w-5 h-5", isLight ? "text-indigo-600" : "text-indigo-400")}
                />
                <h2
                  className={cn(
                    "text-sm font-black uppercase tracking-wider",
                    isLight ? "text-slate-900" : "text-white",
                  )}
                >
                  Ask supplier
                </h2>
              </div>
              <p
                className={cn(
                  "text-xs leading-relaxed",
                  isLight ? "text-slate-600" : "text-slate-400",
                )}
              >
                Link this ticket to a Shopify order, then send a separate chat message to each supplier
                that provides products on that order. You can reply to the customer in Gmail yourself once
                the supplier responds.
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  placeholder="Order # (e.g. 1002)"
                  value={orderRefInput}
                  onChange={(e) => setOrderRefInput(e.target.value)}
                  className={cn(
                    "flex-1 h-10 px-3 rounded-xl border text-sm font-medium",
                    isLight
                      ? "bg-slate-50 border-slate-200 text-slate-900"
                      : "bg-white/5 border-white/10 text-white placeholder:text-slate-500",
                  )}
                />
                <button
                  type="button"
                  disabled={askPreviewLoading}
                  onClick={() => void loadAskSupplierPreview()}
                  className={cn(
                    "h-10 px-4 rounded-xl font-bold text-sm shrink-0",
                    isLight
                      ? "bg-indigo-600 text-white hover:bg-indigo-500"
                      : "bg-indigo-600 text-white hover:bg-indigo-500",
                  )}
                >
                  {askPreviewLoading ? "Loading…" : "Load suppliers"}
                </button>
              </div>
              {askPreviewError && (
                <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">{askPreviewError}</p>
              )}
              {askPreview?.order && askPreview.groups.length > 0 && (
                <div className="space-y-4">
                  <p
                    className={cn(
                      "text-xs font-bold",
                      isLight ? "text-slate-700" : "text-slate-300",
                    )}
                  >
                    Order #{askPreview.order.orderNumber} — message each supplier separately.
                  </p>
                  {askPreview.groups.map((g) => (
                    <div
                      key={g.supplierUserId}
                      className={cn(
                        "rounded-xl border p-4 space-y-2",
                        isLight ? "bg-slate-50 border-slate-200" : "bg-black/20 border-white/10",
                      )}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span
                          className={cn(
                            "text-sm font-black",
                            isLight ? "text-slate-900" : "text-white",
                          )}
                        >
                          {g.companyName}
                        </span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={draftingSupplierId === g.supplierUserId}
                            onClick={() => void draftForSupplier(g.supplierUserId)}
                            className={cn(
                              "h-8 px-3 rounded-lg text-xs font-bold flex items-center gap-1",
                              isLight
                                ? "bg-white border border-slate-200 text-slate-800"
                                : "bg-white/10 text-slate-200",
                            )}
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            {draftingSupplierId === g.supplierUserId ? "Draft…" : "Draft"}
                          </button>
                          <button
                            type="button"
                            disabled={sendingSupplierId === g.supplierUserId}
                            onClick={() => void sendToSupplier(g.supplierUserId)}
                            className="h-8 px-3 rounded-lg text-xs font-bold bg-indigo-600 text-white flex items-center gap-1"
                          >
                            <Send className="w-3.5 h-3.5" />
                            {sendingSupplierId === g.supplierUserId ? "…" : "Send"}
                          </button>
                        </div>
                      </div>
                      <ul
                        className={cn(
                          "text-[11px] list-disc list-inside",
                          isLight ? "text-slate-600" : "text-slate-400",
                        )}
                      >
                        {g.lines.map((l) => (
                          <li key={`${g.supplierUserId}-${l.lineIndex}`}>
                            {l.title}
                            {l.sku ? ` (${l.sku})` : ""} × {l.quantity}
                          </li>
                        ))}
                      </ul>
                      <textarea
                        value={msgBySupplier[g.supplierUserId] || ""}
                        onChange={(e) =>
                          setMsgBySupplier((prev) => ({
                            ...prev,
                            [g.supplierUserId]: e.target.value,
                          }))
                        }
                        placeholder="Your question to this supplier…"
                        rows={4}
                        className={cn(
                          "w-full rounded-xl border p-3 text-sm resize-y min-h-[96px]",
                          isLight
                            ? "bg-white border-slate-200 text-slate-900"
                            : "bg-white/5 border-white/10 text-white placeholder:text-slate-500",
                        )}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Conversation timeline - Full width corners chat style */}
            <div className="flex-1 overflow-y-auto min-h-0 pr-4 -mr-4 space-y-8 pb-10 custom-scrollbar">
              {ticket.messages.map((message) => {
                const isIncoming =
                  message.trigger === "GMAIL_INCOMING" || message.status === "RECEIVED"

                const fullText = message.bodyPreview || ""
                const lines = fullText.split(/\r?\n/)
                const isExpanded = !!expandedMessages[message.id]
                const hasMore = lines.length > 2
                const displayText =
                  isExpanded || !hasMore ? fullText : lines.slice(0, 2).join("\n")

                return (
                  <div
                    key={message.id}
                    className={cn(
                      "flex w-full animate-in fade-in slide-in-from-bottom-4 duration-500",
                      isIncoming ? "justify-start" : "justify-end"
                    )}
                  >
                    <div
                      className={cn(
                        "w-full sm:max-w-[70%] lg:max-w-[60%] xl:max-w-[50%] rounded-2xl p-6 text-[14px] shadow-xl flex flex-col gap-3 relative transition-all border",
                        isIncoming
                          ? isLight
                            ? "bg-white border-slate-200 text-slate-700 rounded-bl-none shadow-slate-200/50"
                            : "bg-slate-800/40 border-white/10 text-slate-200 rounded-bl-none backdrop-blur-md shadow-black/20"
                          : isLight
                            ? "bg-indigo-600 border-indigo-500 text-white rounded-br-none shadow-indigo-100"
                            : "bg-indigo-600 border-indigo-400/30 text-white rounded-br-none shadow-indigo-900/20"
                      )}
                    >
                      <div className="flex items-center justify-between gap-6 mb-1">
                        <div className="flex items-center gap-3">
                          <span className={cn(
                            "text-[11px] font-black uppercase tracking-widest",
                            isIncoming
                              ? (isLight ? "text-indigo-600" : "text-indigo-400")
                              : "text-indigo-100"
                          )}>
                            {isIncoming ? "Customer" : "JUNO"}
                          </span>
                          <span
                            className={cn(
                              "px-2.5 py-0.5 rounded-md text-[9px] font-black tracking-widest uppercase border",
                              isIncoming
                                ? isLight
                                  ? "bg-slate-100 border-slate-200 text-slate-500"
                                  : "bg-slate-700/50 text-slate-400 border-white/5"
                                : isLight
                                  ? "bg-indigo-800/20 border-indigo-400/30 text-indigo-100"
                                  : "bg-indigo-700/50 text-indigo-50 border-indigo-400/30"
                            )}
                          >
                            {message.status}
                          </span>
                        </div>
                        <span className={cn(
                          "text-[10px] whitespace-nowrap font-bold",
                          isIncoming
                            ? (isLight ? "text-slate-400" : "text-slate-500")
                            : "text-indigo-200"
                        )}>
                          {new Date(message.sentAt).toLocaleTimeString(undefined, {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>

                      {fullText && (
                        <p
                          className={cn(
                            "leading-relaxed whitespace-pre-wrap break-words font-medium",
                            isIncoming
                              ? (isLight ? "text-slate-600" : "text-slate-200")
                              : "text-white"
                          )}
                        >
                          {displayText}
                        </p>
                      )}

                      {hasMore && (
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedMessages((prev) => ({
                              ...prev,
                              [message.id]: !isExpanded,
                            }))
                          }
                          className={cn(
                            "self-start mt-2 text-[10px] font-black uppercase tracking-widest hover:underline transition-all",
                            isIncoming
                              ? (isLight ? "text-indigo-600" : "text-indigo-400")
                              : "text-indigo-100"
                          )}
                        >
                          {isExpanded ? "Show less" : "Show more"}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}

              {ticket.messages.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                  <Ticket className="w-12 h-12 mb-4 opacity-10" />
                  <p className="text-sm font-medium">No messages logged yet for this ticket.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
