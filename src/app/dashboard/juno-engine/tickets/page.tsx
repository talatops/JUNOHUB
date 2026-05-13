"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
    Ticket,
    Search,
    Filter,
    Loader2,
    MoreHorizontal
} from "lucide-react"

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

export default function TicketsPage() {
    const router = useRouter()
    const [searchTerm, setSearchTerm] = useState("")
    const [showFilters, setShowFilters] = useState(false)
    const [statusFilter, setStatusFilter] = useState<"all" | "open" | "pending" | "resolved" | "closed">("all")
    const [tickets, setTickets] = useState<TicketData[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const loadTickets = async () => {
            try {
                setLoading(true)
                setError(null)
                const query = searchTerm.trim()
                const url = query
                    ? `/api/juno-engine/tickets?q=${encodeURIComponent(query)}`
                    : "/api/juno-engine/tickets"
                const res = await fetch(url, {
                    cache: "no-store",
                })
                if (!res.ok) {
                    throw new Error("Failed to load tickets")
                }
                const data = (await res.json()) as { tickets: TicketData[] }
                setTickets(data.tickets || [])
            } catch (err) {
                console.error("Failed to load tickets", err)
                setError("Could not load tickets. Please ensure your Gmail integration is connected.")
            } finally {
                setLoading(false)
            }
        }

        void loadTickets()
    }, [searchTerm])

    const getStatusStyles = (status: TicketStatus | string) => {
        switch (status) {
            case "open": return "bg-blue-500/20 text-blue-400"
            case "pending": return "bg-yellow-500/20 text-yellow-400"
            case "resolved": return "bg-emerald-500/20 text-emerald-400"
            case "closed": return "bg-slate-500/20 text-slate-400"
            default: return "bg-white/10 text-slate-400"
        }
    }

    const filteredTickets = tickets.filter((ticket) => {
        if (statusFilter === "all") return true
        return (ticket.status || "").toLowerCase() === statusFilter
    })

    return (
        <div className="h-full flex flex-col space-y-4 md:space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 flex-shrink-0">
                <div>
                    <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">Tickets</h1>
                    <p className="text-sm md:text-base text-slate-400 mt-1">
                        View conversations between your customers and JUNO support.
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowFilters((prev) => !prev)}
                        className="h-10 md:h-11 px-4 bg-white/10 border border-white/10 rounded-xl font-bold text-slate-300 hover:bg-white/15 transition-all flex items-center justify-center gap-2 text-sm shrink-0"
                    >
                        <Filter className="w-4 h-4" /> Filters
                    </button>
                </div>
            </div>

            {/* Search */}
            <div className="flex flex-col sm:flex-row gap-3 md:gap-4 flex-shrink-0">
                <div className="relative flex-1 min-w-0">
                    <Search className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                        type="text"
                        placeholder="Search tickets by subject, email, or ID..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full h-10 md:h-11 pl-10 md:pl-11 pr-4 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 text-white placeholder:text-slate-500 text-sm font-medium transition-all"
                    />
                </div>
            </div>
            {showFilters && (
                <div className="flex flex-wrap items-center gap-2">
                    {(["all", "open", "pending", "resolved", "closed"] as const).map((status) => (
                        <button
                            key={status}
                            type="button"
                            onClick={() => setStatusFilter(status)}
                            className={`h-8 px-3 rounded-lg text-xs font-bold uppercase tracking-wider ${
                                statusFilter === status
                                    ? "bg-indigo-600 text-white"
                                    : "bg-white/10 text-slate-300 border border-white/10"
                            }`}
                        >
                            {status}
                        </button>
                    ))}
                </div>
            )}

            {/* Tickets Grid */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
                {loading ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3">
                        <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
                        <p className="font-medium animate-pulse">Loading tickets...</p>
                    </div>
                ) : error ? (
                    <div className="h-full flex flex-col items-center justify-center text-red-400 gap-3 text-center px-4">
                        <p className="font-medium">{error}</p>
                    </div>
                ) : filteredTickets.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3">
                        <Ticket className="w-10 h-10 opacity-20" />
                        <p className="font-medium">No tickets found.</p>
                        <p className="text-xs text-slate-500">New conversations will appear here as they come in.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6 h-full content-start">
                        {filteredTickets.map((ticket) => (
                            <div
                                key={ticket.id}
                                className="bg-white/5 rounded-xl border border-white/10 p-5 hover:bg-white/10 hover:border-indigo-500/30 transition-all cursor-pointer group relative"
                                onClick={() => router.push(`/dashboard/juno-engine/tickets/${encodeURIComponent(ticket.id)}`)}
                            >
                                {/* Header */}
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <div className="w-10 h-10 rounded-lg bg-indigo-500/20 border border-indigo-400/20 flex items-center justify-center text-indigo-400 group-hover:bg-indigo-500/30 transition-all shrink-0">
                                            <Ticket className="w-5 h-5" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-black text-base text-white truncate">{ticket.subject}</h3>
                                            <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                                                {ticket.customerEmail}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={(e) => e.stopPropagation()}
                                        className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-indigo-400 transition-all shrink-0"
                                    >
                                        <MoreHorizontal className="w-4 h-4" />
                                    </button>
                                </div>

                                {/* Conversation snippet */}
                                <div className="mb-4">
                                    <p className="text-xs text-slate-300 line-clamp-3">
                                        {ticket.lastMessageSnippet}
                                    </p>
                                </div>

                                {/* Meta */}
                                <div className="flex items-center justify-between gap-2 text-xs">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${getStatusStyles(ticket.status as TicketStatus)}`}>
                                            {ticket.status}
                                        </span>
                                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/5 text-slate-300 border border-white/10">
                                            {ticket.messagesCount} messages
                                        </span>
                                    </div>
                                    <div className="text-right text-[11px] text-slate-500">
                                        <p>Updated {new Date(ticket.updatedAt).toLocaleDateString()}</p>
                                    </div>
                                </div>

                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
