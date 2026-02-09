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
            Ticket Conversation
          </h1>
          <p className="text-sm md:text-base text-slate-400 mt-1">
            Full automated email history for this customer.
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
          <div className="max-w-3xl mx-auto">
            <div className="bg-white/5 rounded-2xl border border-white/10 p-6 md:p-7 space-y-5">
              {/* Ticket header */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-indigo-500/20 border border-indigo-400/20 flex items-center justify-center text-indigo-400 shrink-0">
                    <Ticket className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg md:text-xl font-extrabold text-white truncate">
                      {ticket.subject}
                    </h2>
                    <p className="text-xs text-slate-400 mt-1 truncate">
                      {ticket.customerEmail}
                    </p>
                  </div>
                </div>
                <button className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-indigo-400 transition-all shrink-0">
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </div>

              {/* Summary */}
              <div className="text-sm text-slate-200">
                <p className="line-clamp-3">{ticket.lastMessageSnippet}</p>
              </div>

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

              {/* Conversation timeline */}
              <div className="pt-4 border-t border-white/10 space-y-3">
                {ticket.messages.map((message) => (
                  <div
                    key={message.id}
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-[11px] text-slate-200"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-100 uppercase tracking-wide">
                          {message.trigger || "AUTOMATED"}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-slate-900/40 border border-white/10 text-[10px] text-slate-300">
                          {message.status}
                        </span>
                      </div>
                      <span className="text-slate-500">
                        {new Date(message.sentAt).toLocaleString()}
                      </span>
                    </div>
                    {message.bodyPreview && (
                      <p className="text-slate-300 leading-snug">
                        {message.bodyPreview}
                      </p>
                    )}
                  </div>
                ))}

                {ticket.messages.length === 0 && (
                  <p className="text-[11px] text-slate-500">
                    No messages logged yet for this ticket.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

