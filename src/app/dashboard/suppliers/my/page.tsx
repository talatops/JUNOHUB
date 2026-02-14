"use client"

import { useEffect, useState } from "react"
import {
    Users,
    Loader2,
    AlertCircle,
    CheckCircle2,
    Clock,
    XCircle,
    Building2,
    Mail,
    Package,
    Globe,
    X,
    Store
} from "lucide-react"

interface Connection {
    id: string
    status: "PENDING" | "CONNECTED" | "REJECTED"
    createdAt: string
    supplier: {
        id: string
        companyName: string
        description: string | null
        user: {
            name: string | null
            email: string | null
        }
        _count: {
            products: number
        }
    }
    store?: {
        id: string
        businessName: string
        isActive: boolean
    }
}

export default function MySuppliersPage() {
    const [connections, setConnections] = useState<Connection[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState("")
    const [success, setSuccess] = useState("")
    const [filter, setFilter] = useState<"ALL" | "PENDING" | "CONNECTED" | "REJECTED">("ALL")
    const [cancellingId, setCancellingId] = useState<string | null>(null)

    useEffect(() => {
        fetchMySuppliers()
    }, [])

    // Poll for updates every 5 seconds if there are pending connections
    useEffect(() => {
        const hasPending = connections.some(c => c.status === "PENDING")
        if (!hasPending) return // Don't poll if no pending connections
        
        const interval = setInterval(() => {
            fetchMySuppliers()
        }, 5000) // Poll every 5 seconds
        
        return () => clearInterval(interval)
         
    }, [connections]) // Re-run when connections change

    useEffect(() => {
        if (success) {
            const timer = setTimeout(() => setSuccess(""), 5000)
            return () => clearTimeout(timer)
        }
    }, [success])

    useEffect(() => {
        if (error) {
            const timer = setTimeout(() => setError(""), 5000)
            return () => clearTimeout(timer)
        }
    }, [error])

    const fetchMySuppliers = async () => {
        try {
            setLoading(true)
            const res = await fetch("/api/vendors/suppliers/my")
            if (!res.ok) throw new Error("Failed to fetch suppliers")
            const data = await res.json()
            setConnections(data.connections || [])
            setError("")
        } catch {
            setError("Failed to load suppliers")
        } finally {
            setLoading(false)
        }
    }

    const handleCancelInvitation = async (supplierId: string) => {
        setCancellingId(supplierId)
        setError("")
        try {
            const res = await fetch(`/api/vendors/suppliers/${supplierId}/invite`, {
                method: "DELETE"
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.message || "Failed to cancel invitation")
            setSuccess("Invitation cancelled successfully. You can now send a new invitation.")
            fetchMySuppliers() // Refresh the list
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to cancel invitation")
        } finally {
            setCancellingId(null)
        }
    }

    const filteredConnections = connections.filter((conn) =>
        filter === "ALL" ? true : conn.status === filter
    )

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "CONNECTED":
                return (
                    <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full text-xs font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Connected
                    </span>
                )
            case "PENDING":
                return (
                    <span className="px-3 py-1 bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded-full text-xs font-medium flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Pending
                    </span>
                )
            case "REJECTED":
                return (
                    <span className="px-3 py-1 bg-red-500/20 text-red-400 border border-red-500/30 rounded-full text-xs font-medium flex items-center gap-1">
                        <XCircle className="w-3 h-3" />
                        Rejected
                    </span>
                )
            default:
                return null
        }
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">My Suppliers</h1>
                <p className="text-sm md:text-base text-slate-400 mt-1">Manage your existing supplier connections.</p>
            </div>

            {success && (
                <div className="bg-emerald-500/20 border border-emerald-500/30 rounded-xl p-4 flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <span className="text-sm text-emerald-400 font-medium">{success}</span>
                </div>
            )}

            {error && (
                <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-4 flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-red-400" />
                    <span className="text-sm text-red-400 font-medium">{error}</span>
                </div>
            )}

            {/* Filter Tabs */}
            <div className="flex gap-1 sm:gap-2 border-b border-white/10 overflow-x-auto">
                {(["ALL", "PENDING", "CONNECTED", "REJECTED"] as const).map((status) => (
                    <button
                        key={status}
                        onClick={() => setFilter(status)}
                        className={`px-3 sm:px-4 py-2 font-medium transition-colors border-b-2 whitespace-nowrap text-sm sm:text-base ${
                            filter === status
                                ? "text-white border-indigo-500"
                                : "text-slate-400 border-transparent hover:text-white"
                        }`}
                    >
                        {status.charAt(0) + status.slice(1).toLowerCase()}
                        {status !== "ALL" && (
                            <span className="ml-1 sm:ml-2 px-1.5 sm:px-2 py-0.5 bg-white/10 rounded-full text-xs">
                                {connections.filter((c) => c.status === status).length}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
                </div>
            ) : filteredConnections.length === 0 ? (
                <div className="bg-white/5 rounded-xl p-12 border border-white/10 text-center">
                    <Users className="w-12 h-12 text-slate-400 mx-auto mb-4 opacity-50" />
                    <h3 className="text-lg font-bold text-white mb-2">No Connected Suppliers</h3>
                    <p className="text-sm text-slate-400">
                        {filter === "ALL" 
                            ? "You haven't connected with any suppliers yet. Browse the global marketplace to find suppliers."
                            : `No ${filter.toLowerCase()} suppliers`}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                    {filteredConnections.map((connection) => (
                        <div
                            key={connection.id}
                            className="bg-white/5 rounded-xl p-4 sm:p-6 border border-white/10 hover:border-white/20 transition-colors"
                        >
                            <div className="flex items-start justify-between gap-2 mb-4">
                                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center flex-shrink-0">
                                        <Building2 className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-400" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h3 className="font-bold text-white text-sm sm:text-base truncate">{connection.supplier.companyName}</h3>
                                        {connection.supplier.user.name && (
                                            <p className="text-xs text-slate-400 truncate">{connection.supplier.user.name}</p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex-shrink-0">
                                    {getStatusBadge(connection.status)}
                                </div>
                            </div>

                            {connection.supplier.description && (
                                <p className="text-sm text-slate-300 mb-4 line-clamp-2">{connection.supplier.description}</p>
                            )}

                            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mb-4">
                                <div className="flex items-center gap-1">
                                    <Package className="w-4 h-4 flex-shrink-0" />
                                    <span>{connection.supplier._count.products} products</span>
                                </div>
                                {connection.supplier.user.email && (
                                    <div className="flex items-center gap-1 min-w-0">
                                        <Mail className="w-4 h-4 flex-shrink-0" />
                                        <span className="truncate">{connection.supplier.user.email}</span>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-3 pt-4 border-t border-white/10">
                                <div className="flex items-center justify-between">
                                    <div className="text-xs text-slate-500">
                                        {connection.status === "PENDING" ? "Invited" : "Connected"}: {new Date(connection.createdAt).toLocaleDateString()}
                                    </div>
                                    {connection.status === "PENDING" && (
                                        <button
                                            onClick={() => handleCancelInvitation(connection.supplier.id)}
                                            disabled={cancellingId === connection.supplier.id}
                                            className="px-3 py-1.5 text-xs font-medium text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                                        >
                                            {cancellingId === connection.supplier.id ? (
                                                <>
                                                    <Loader2 className="w-3 h-3 animate-spin" />
                                                    Cancelling...
                                                </>
                                            ) : (
                                                <>
                                                    <X className="w-3 h-3" />
                                                    Cancel
                                                </>
                                            )}
                                        </button>
                                    )}
                                </div>
                                {connection.store && (
                                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                                        <Store className="w-3 h-3" />
                                        <span className="truncate">{connection.store.businessName}</span>
                                        {!connection.store.isActive && (
                                            <span className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 rounded text-xs">Inactive</span>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
