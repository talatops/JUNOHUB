"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import {
    Users,
    CheckCircle2,
    XCircle,
    Clock,
    Loader2,
    AlertCircle,
    Mail,
    Building2,
    Globe,
    Trash2,
    Key,
    X,
    Package,
    Check,
    X as XIcon
} from "lucide-react"

interface Connection {
    id: string
    status: "PENDING" | "CONNECTED" | "REJECTED"
    createdAt: string
    store: {
        id: string
        businessName: string
        shopifyDomain: string | null
        shopifyStoreName: string | null
        user: {
            name: string | null
            email: string | null
        }
    }
}

interface ProductSync {
    id: string
    shopifyProductId: string
    shopifyProductTitle: string
    status: "PENDING" | "ACCEPTED" | "REJECTED"
    createdAt: string
    store: {
        id: string
        businessName: string
        user: {
            name: string | null
            email: string | null
        }
    }
}

function SupplierVendorsContent() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const [connections, setConnections] = useState<Connection[]>([])
    const [productSyncs, setProductSyncs] = useState<ProductSync[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState("")
    const [success, setSuccess] = useState("")
    const [filter, setFilter] = useState<"ALL" | "PENDING" | "CONNECTED" | "REJECTED">("ALL")
    const [showTokenInput, setShowTokenInput] = useState(false)
    const [invitationToken, setInvitationToken] = useState("")
    const [acceptingToken, setAcceptingToken] = useState(false)
    const [showProductSyncs, setShowProductSyncs] = useState(false)
    const [isInitialLoad, setIsInitialLoad] = useState(true)

    useEffect(() => {
        void (async () => {
            await Promise.all([fetchConnections({ silent: false }), fetchProductSyncs()])
            setIsInitialLoad(false)
        })()
        
        // Check if token is in URL
        const token = searchParams.get("token")
        if (token) {
            setInvitationToken(token.toUpperCase())
            setShowTokenInput(true)
        }
    }, [searchParams])

    // Poll for updates every 5 seconds so new invitations appear without manual refresh
    useEffect(() => {
        const interval = setInterval(() => {
            void fetchConnections({ silent: true })
            void fetchProductSyncs()
        }, 5000) // Poll every 5 seconds
        
        return () => clearInterval(interval)
    }, [])

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

    const fetchConnections = async ({ silent = false }: { silent?: boolean } = {}) => {
        try {
            if (!silent) setLoading(true)
            const res = await fetch("/api/supplier/vendors")
            if (!res.ok) throw new Error("Failed to fetch connections")
            const data = await res.json()
            setConnections(data.connections || [])
            setError("")
        } catch {
            setError("Failed to load vendor connections")
        } finally {
            if (!silent) setLoading(false)
        }
    }

    const fetchProductSyncs = async () => {
        try {
            const res = await fetch("/api/supplier/product-syncs?status=PENDING")
            if (res.ok) {
                const data = await res.json()
                setProductSyncs(data.syncs || [])
            }
        } catch (error) {
            console.error("Error fetching product syncs:", error)
        }
    }

    const handleStatusChange = async (connectionId: string, status: "CONNECTED" | "REJECTED") => {
        try {
            const res = await fetch(`/api/supplier/vendors/${connectionId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status })
            })
            if (!res.ok) throw new Error("Failed to update connection")
            setSuccess(`Connection ${status.toLowerCase()} successfully`)
            void fetchConnections({ silent: true })
        } catch {
            setError("Failed to update connection")
        }
    }

    const handleDelete = async (connectionId: string) => {
        if (!confirm("Are you sure you want to remove this connection?")) return

        try {
            const res = await fetch(`/api/supplier/vendors/${connectionId}`, {
                method: "DELETE"
            })
            if (!res.ok) throw new Error("Failed to delete connection")
            setSuccess("Connection removed successfully")
            void fetchConnections({ silent: true })
        } catch {
            setError("Failed to remove connection")
        }
    }

    const handleProductSyncAction = async (syncId: string, action: "accept" | "reject") => {
        try {
            const res = await fetch(`/api/products/sync/${syncId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action })
            })
            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.message || "Failed to update sync request")
            }
            setSuccess(`Product sync ${action === "accept" ? "accepted" : "rejected"} successfully`)
            void fetchProductSyncs()
            void fetchConnections({ silent: true })
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to update sync request")
        }
    }

    const handleAcceptInvitation = async () => {
        if (!invitationToken || invitationToken.length !== 16) {
            setError("Please enter a valid 16-character invitation token")
            return
        }

        setAcceptingToken(true)
        setError("")
        try {
            const res = await fetch("/api/supplier/invitations/accept", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token: invitationToken.toUpperCase() })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.message || "Failed to accept invitation")
            setSuccess(data.message || "Invitation accepted successfully! You are now connected.")
            setInvitationToken("")
            setShowTokenInput(false)
            void fetchConnections({ silent: true })
            // Send supplier to JUNO CHAT so encryption keys auto-setup on first open
            setTimeout(() => router.push("/supplier/chat"), 1500)
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to accept invitation")
        } finally {
            setAcceptingToken(false)
        }
    }

    const filteredConnections = connections.filter((conn) =>
        filter === "ALL" ? true : conn.status === filter
    )

    const getStatusIcon = (status: string) => {
        switch (status) {
            case "CONNECTED":
                return <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            case "REJECTED":
                return <XCircle className="w-4 h-4 text-red-400" />
            default:
                return <Clock className="w-4 h-4 text-yellow-400" />
        }
    }

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "CONNECTED":
                return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
            case "REJECTED":
                return "bg-red-500/20 text-red-400 border-red-500/30"
            default:
                return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">Vendors</h1>
                    <p className="text-sm md:text-base text-slate-400 mt-1">Manage your vendor connections</p>
                </div>
                <div className="flex gap-2">
                    {productSyncs.length > 0 && (
                        <button
                            onClick={() => setShowProductSyncs(!showProductSyncs)}
                            className="px-4 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 border border-yellow-500/30 rounded-lg font-medium transition-colors flex items-center gap-2 relative"
                        >
                            <Package className="w-4 h-4" />
                            Product Sync Requests
                            <span className="ml-1 px-2 py-0.5 bg-yellow-500/30 rounded-full text-xs font-bold">
                                {productSyncs.length}
                            </span>
                        </button>
                    )}
                    {!showTokenInput && (
                        <button
                            onClick={() => setShowTokenInput(true)}
                            className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                        >
                            <Key className="w-4 h-4" />
                            Enter Invitation Token
                        </button>
                    )}
                </div>
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

            {/* Invitation Token Input */}
            {showTokenInput && (
                <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-6">
                    <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-500/20 rounded-lg">
                                <Key className="w-5 h-5 text-indigo-400" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white mb-1">Accept Invitation</h3>
                                <p className="text-sm text-slate-400">Enter the invitation token you received via email</p>
                            </div>
                        </div>
                        <button
                            onClick={() => {
                                setShowTokenInput(false)
                                setInvitationToken("")
                                setError("")
                            }}
                            className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="flex gap-3">
                        <input
                            type="text"
                            value={invitationToken}
                            onChange={(e) => {
                                const value = e.target.value.replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 16)
                                setInvitationToken(value)
                            }}
                            placeholder="Enter 16-character token"
                            className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 font-mono text-center text-lg tracking-widest"
                            maxLength={16}
                        />
                        <button
                            onClick={handleAcceptInvitation}
                            disabled={acceptingToken || invitationToken.length !== 16}
                            className="px-6 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {acceptingToken ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Accepting...
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="w-4 h-4" />
                                    Accept
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* Product Sync Requests */}
            {showProductSyncs && productSyncs.length > 0 && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-yellow-500/20 rounded-lg">
                                <Package className="w-5 h-5 text-yellow-400" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white mb-1">Product Sync Requests</h3>
                                <p className="text-sm text-slate-400">Vendors want to sync products with you</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowProductSyncs(false)}
                            className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="space-y-3">
                        {productSyncs.map((sync) => (
                            <div
                                key={sync.id}
                                className="bg-white/5 border border-white/10 rounded-lg p-4"
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Building2 className="w-4 h-4 text-slate-400" />
                                            <span className="font-bold text-white">{sync.store.businessName}</span>
                                        </div>
                                        <p className="text-sm text-white font-medium mt-2">{sync.shopifyProductTitle}</p>
                                        <p className="text-xs text-slate-500 mt-1">Product ID: {sync.shopifyProductId}</p>
                                        <p className="text-xs text-slate-500 mt-1">
                                            Requested: {new Date(sync.createdAt).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-2 pt-3 border-t border-white/10">
                                    <button
                                        onClick={() => handleProductSyncAction(sync.id, "accept")}
                                        className="flex-1 px-3 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                                    >
                                        <Check className="w-4 h-4" />
                                        Accept
                                    </button>
                                    <button
                                        onClick={() => handleProductSyncAction(sync.id, "reject")}
                                        className="flex-1 px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                                    >
                                        <XIcon className="w-4 h-4" />
                                        Reject
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Filter Tabs */}
            <div className="flex gap-2 border-b border-white/10">
                {(["ALL", "PENDING", "CONNECTED", "REJECTED"] as const).map((status) => (
                    <button
                        key={status}
                        onClick={() => setFilter(status)}
                        className={`px-4 py-2 font-medium transition-colors border-b-2 ${
                            filter === status
                                ? "text-white border-indigo-500"
                                : "text-slate-400 border-transparent hover:text-white"
                        }`}
                    >
                        {status.charAt(0) + status.slice(1).toLowerCase()}
                        {status !== "ALL" && (
                            <span className="ml-2 px-2 py-0.5 bg-white/10 rounded-full text-xs">
                                {connections.filter((c) => c.status === status).length}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {loading && isInitialLoad ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
                </div>
            ) : filteredConnections.length === 0 ? (
                <div className="bg-white/5 rounded-xl p-12 border border-white/10 text-center">
                    <Users className="w-12 h-12 text-slate-400 mx-auto mb-4 opacity-50" />
                    <p className="text-slate-400 font-medium">
                        {filter === "ALL" ? "No vendor connections yet" : `No ${filter.toLowerCase()} connections`}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredConnections.map((connection) => (
                        <div
                            key={connection.id}
                            onClick={() => {
                                if (connection.status === "CONNECTED") {
                                    router.push(`/supplier/vendors/${connection.id}`)
                                }
                            }}
                            className={`bg-white/5 rounded-xl p-6 border border-white/10 transition-colors text-left w-full ${
                                connection.status === "CONNECTED"
                                    ? "hover:border-white/20 cursor-pointer"
                                    : "cursor-default"
                            }`}
                            role={connection.status === "CONNECTED" ? "button" : undefined}
                            tabIndex={connection.status === "CONNECTED" ? 0 : -1}
                            onKeyDown={(e) => {
                                if (
                                    connection.status === "CONNECTED" &&
                                    (e.key === "Enter" || e.key === " ")
                                ) {
                                    e.preventDefault()
                                    router.push(`/supplier/vendors/${connection.id}`)
                                }
                            }}
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    {getStatusIcon(connection.status)}
                                    <span
                                        className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusBadge(
                                            connection.status
                                        )}`}
                                    >
                                        {connection.status}
                                    </span>
                                </div>
                                {connection.status !== "PENDING" && (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            void handleDelete(connection.id)
                                        }}
                                        className="p-1 hover:bg-red-500/20 rounded text-slate-400 hover:text-red-400 transition-colors"
                                        title="Remove"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                            </div>

                            <div className="space-y-3">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <Building2 className="w-4 h-4 text-slate-400" />
                                        <span className="font-bold text-white">{connection.store.businessName}</span>
                                    </div>
                                    {connection.store.shopifyStoreName && (
                                        <p className="text-sm text-slate-400 ml-6">{connection.store.shopifyStoreName}</p>
                                    )}
                                </div>

                                <div className="flex items-center gap-2 text-sm text-slate-400">
                                    <Mail className="w-4 h-4" />
                                    <span>{connection.store.user.email}</span>
                                </div>

                                {connection.store.shopifyDomain && (
                                    <div className="flex items-center gap-2 text-sm text-slate-400">
                                        <Globe className="w-4 h-4" />
                                        <span className="truncate">{connection.store.shopifyDomain}</span>
                                    </div>
                                )}

                                <div className="text-xs text-slate-500 mt-4">
                                    Connected: {new Date(connection.createdAt).toLocaleDateString()}
                                </div>
                            </div>

                            {connection.status === "PENDING" && (
                                <div className="flex gap-2 mt-4 pt-4 border-t border-white/10">
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            void handleStatusChange(connection.id, "CONNECTED")
                                        }}
                                        className="flex-1 px-3 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                                    >
                                        <CheckCircle2 className="w-4 h-4" />
                                        Accept
                                    </button>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            void handleStatusChange(connection.id, "REJECTED")
                                        }}
                                        className="flex-1 px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                                    >
                                        <XCircle className="w-4 h-4" />
                                        Reject
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

export default function SupplierVendorsPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
            </div>
        }>
            <SupplierVendorsContent />
        </Suspense>
    )
}
