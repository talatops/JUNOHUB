"use client"

import { useState, useEffect, useCallback } from "react"
import {
    Flag,
    Search,
    Filter,
    Loader2,
    Trash2,
    Archive,
    CheckCircle2
} from "lucide-react"

interface FlaggedEmail {
    id: string
    subject: string
    from: string
    flaggedAt: string
    reason: string
    priority: "low" | "medium" | "high"
}

export default function FlaggedEmailPage() {
    const [searchTerm, setSearchTerm] = useState("")
    const [flaggedEmails, setFlaggedEmails] = useState<FlaggedEmail[]>([])
    const [loading, setLoading] = useState(true)
    const [deletingId, setDeletingId] = useState<string | null>(null)

    const fetchFlaggedEmails = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch("/api/juno-engine/flagged-emails")
            if (res.ok) {
                const data = await res.json()
                setFlaggedEmails(data.flaggedEmails ?? [])
            }
        } catch {
            setFlaggedEmails([])
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchFlaggedEmails()
    }, [fetchFlaggedEmails])

    const handleDelete = async (id: string) => {
        setDeletingId(id)
        try {
            const res = await fetch(`/api/juno-engine/flagged-emails/${id}`, { method: "DELETE" })
            if (res.ok) {
                setFlaggedEmails((prev) => prev.filter((e) => e.id !== id))
            }
        } finally {
            setDeletingId(null)
        }
    }

    const filtered = flaggedEmails.filter(
        (e) =>
            e.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
            e.from.toLowerCase().includes(searchTerm.toLowerCase()) ||
            e.reason.toLowerCase().includes(searchTerm.toLowerCase()) ||
            e.priority.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const priorityClass = (p: FlaggedEmail["priority"]) => {
        if (p === "high") return "bg-red-500/15 text-red-300 border-red-500/30"
        if (p === "low") return "bg-slate-500/15 text-slate-300 border-slate-500/30"
        return "bg-amber-500/15 text-amber-200 border-amber-500/30"
    }

    return (
        <div className="h-full flex flex-col space-y-4 md:space-y-6">
            <div className="bg-white/5 backdrop-blur-xl rounded-xl md:rounded-2xl border border-white/10 overflow-hidden flex flex-col flex-1 min-h-0">
                <div className="p-4 md:p-6 border-b border-white/10 flex flex-col sm:flex-row gap-3 md:gap-4 justify-between bg-white/5 flex-shrink-0">
                    <div className="relative flex-1 min-w-0">
                        <Search className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Search flagged emails..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full h-10 md:h-11 pl-10 md:pl-11 pr-4 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 text-white placeholder:text-slate-500 text-sm font-medium transition-all"
                        />
                    </div>
                    <div className="flex gap-2">
                        <button className="h-10 md:h-11 px-4 bg-white/10 border border-white/10 rounded-xl font-bold text-slate-300 hover:bg-white/15 transition-all flex items-center justify-center gap-2 text-sm shrink-0">
                            <Filter className="w-4 h-4" /> Filters
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto overflow-x-auto -mx-4 md:mx-0">
                    <div className="min-w-full px-4 md:px-0">
                        {loading ? (
                            <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-3">
                                <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
                                <p className="font-medium animate-pulse">Loading flagged emails...</p>
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-3">
                                <Flag className="w-10 h-10 opacity-20" />
                                <p className="font-medium">No flagged emails found.</p>
                                <p className="text-xs text-slate-500 max-w-md text-center">
                                    Messages classified as phishing, abuse, or policy bypass are stored here. No auto-reply
                                    is sent for those.
                                </p>
                            </div>
                        ) : (
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-white/5 border-b border-white/10">
                                        <th className="px-4 md:px-8 py-3 md:py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest min-w-[200px] text-left">Subject</th>
                                        <th className="px-3 md:px-6 py-3 md:py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap text-left">From</th>
                                        <th className="px-3 md:px-6 py-3 md:py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap hidden sm:table-cell text-left">
                                            Priority
                                        </th>
                                        <th className="px-3 md:px-6 py-3 md:py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap text-left">Reason</th>
                                        <th className="px-3 md:px-6 py-3 md:py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap hidden md:table-cell text-left">Flagged</th>
                                        <th className="px-4 md:px-8 py-3 md:py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {filtered.map((email) => (
                                        <tr key={email.id} className="hover:bg-white/5 transition-colors group">
                                            <td className="px-4 md:px-8 py-3 md:py-4">
                                                <div className="flex items-center gap-2">
                                                    <Flag className="w-4 h-4 text-red-400 shrink-0" />
                                                    <span className="font-bold text-sm md:text-base text-white group-hover:text-indigo-400 transition-colors truncate">{email.subject}</span>
                                                </div>
                                            </td>
                                            <td className="px-3 md:px-6 py-3 md:py-4">
                                                <span className="text-sm font-medium text-slate-300">{email.from}</span>
                                            </td>
                                            <td className="px-3 md:px-6 py-3 md:py-4 hidden sm:table-cell">
                                                <span
                                                    className={`inline-flex text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-md border ${priorityClass(email.priority)}`}
                                                >
                                                    {email.priority}
                                                </span>
                                            </td>
                                            <td className="px-3 md:px-6 py-3 md:py-4">
                                                <span className="text-xs text-slate-400 font-medium line-clamp-3 max-w-md">
                                                    {email.reason}
                                                </span>
                                            </td>
                                            <td className="px-3 md:px-6 py-3 md:py-4 hidden md:table-cell">
                                                <span className="text-xs text-slate-500 font-medium">{new Date(email.flaggedAt).toLocaleDateString()}</span>
                                            </td>
                                            <td className="px-4 md:px-8 py-3 md:py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-emerald-400 transition-all" title="Resolve">
                                                        <CheckCircle2 className="w-4 h-4" />
                                                    </button>
                                                    <button className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-indigo-400 transition-all" title="Archive">
                                                        <Archive className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDelete(email.id)}
                                                        className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-red-400 transition-all"
                                                        title="Delete"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
