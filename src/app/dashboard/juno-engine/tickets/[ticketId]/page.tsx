"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Ticket, Loader2, MoreHorizontal } from "lucide-react"

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

export default function TicketDetailPage() {
  const params = useParams<{ ticketId: string }>()
  const router = useRouter()
  const [ticket, setTicket] = useState<TicketData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedMessages, setExpandedMessages] = useState<Record<string, boolean>>({})

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

  const getStatusStyles = (status: TicketStatus | string) => {
    switch (status) {
      case "open":
        return "bg-blue-500/20 text-blue-400"
      case "pending":
        return "bg-yellow-500/20 text-yellow-400"
      case "resolved":
        return "bg-emerald-500/20 text-emerald-400"
      case "closed":
        return "bg-slate-500/20 text-slate-400"
      default:
        return "bg-white/10 text-slate-400"
    }
  }

  return (
    <div className="h-full flex flex-col space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <button
          onClick={() => router.push("/dashboard/juno-engine/tickets")}
          className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            {ticket?.subject || "Ticket"}
          </h1>
          <p className="text-sm md:text-base text-slate-400 mt-1">
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
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="max-w-4xl mx-auto px-2 md:px-0 space-y-4">
            {/* Meta badges */}
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${getStatusStyles(
                    ticket.status as TicketStatus
                  )}`}
                >
                  {ticket.status}
                </span>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/5 text-slate-300 border border-white/10">
                  {ticket.messagesCount} messages
                </span>
              </div>
              <div className="text-[11px] text-slate-500">
                Updated{" "}
                {new Date(ticket.updatedAt).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </div>
            </div>

            {/* Conversation timeline - chat style */}
            <div className="pt-2 space-y-4">
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
                      className={`flex w-full ${isIncoming ? "justify-start" : "justify-end"}`}
                    >
                      <div
                        className={`w-full sm:max-w-[88%] rounded-2xl px-4 py-3 text-xs shadow-sm flex flex-col gap-1
                          ${
                            isIncoming
                              ? "bg-slate-900/70 border border-white/10 rounded-bl-sm"
                              : "bg-indigo-500/90 border border-indigo-300/60 text-white rounded-br-sm"
                          }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-semibold uppercase tracking-wide opacity-80">
                              {isIncoming ? "Customer" : "JUNOHUB"}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[9px] font-semibold tracking-wide
                                ${
                                  isIncoming
                                    ? "bg-slate-800/80 text-slate-200 border border-white/10"
                                    : "bg-indigo-600/90 text-indigo-50 border border-indigo-300/70"
                                }`}
                            >
                              {message.status}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 whitespace-nowrap">
                            {new Date(message.sentAt).toLocaleTimeString(undefined, {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>

                        {fullText && (
                          <p
                            className={`mt-0.5 leading-snug whitespace-pre-wrap break-words ${
                              isIncoming ? "text-slate-200" : "text-indigo-50"
                            }`}
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
                            className={`self-end mt-1 text-[10px] font-medium underline underline-offset-2 ${
                              isIncoming ? "text-slate-300" : "text-indigo-100"
                            }`}
                          >
                            {isExpanded ? "Show less" : "Show more"}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}

                {ticket.messages.length === 0 && (
                  <p className="text-[11px] text-slate-500 text-center">
                    No messages logged yet for this ticket.
                  </p>
                )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

