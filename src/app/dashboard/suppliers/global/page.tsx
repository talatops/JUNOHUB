"use client"

import { useEffect, useState } from "react"
import {
    Package,
    Search,
    Mail,
    Loader2,
    AlertCircle,
    CheckCircle2,
    Clock,
    XCircle,
    Building2,
    Users,
    X,
    Store
} from "lucide-react"
import Image from "next/image"
import { useTheme } from "@/components/ThemeProvider"
import { cn } from "@/lib/utils"

interface Supplier {
    id: string
    companyName: string
    description: string | null
    createdAt: string
    connectionStatus: "NONE" | "PENDING" | "CONNECTED" | "REJECTED"
    user: {
        id: string
        name: string | null
        email: string | null
    }
    _count: {
        products: number
        connections: number
    }
}

export default function GlobalSuppliersPage() {
    const [suppliers, setSuppliers] = useState<Supplier[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState("")
    const [success, setSuccess] = useState("")
    const [searchTerm, setSearchTerm] = useState("")
    const [invitingId, setInvitingId] = useState<string | null>(null)
    const [showInviteModal, setShowInviteModal] = useState(false)
    const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null)
    const [connectToAllStores, setConnectToAllStores] = useState(false)
    const { theme } = useTheme()
    const isLight = theme === "light"

    useEffect(() => {
        fetchSuppliers()
    }, [])

    // Poll for updates every 5 seconds if there are pending suppliers
    useEffect(() => {
        const hasPending = suppliers.some(s => s.connectionStatus === "PENDING")
        if (!hasPending) return // Don't poll if no pending suppliers
        
        const interval = setInterval(() => {
            fetchSuppliers()
        }, 5000) // Poll every 5 seconds
        
        return () => clearInterval(interval)
         
    }, [suppliers]) // Re-run when suppliers change

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

    const fetchSuppliers = async () => {
        try {
            setLoading(true)
            const res = await fetch("/api/vendors/suppliers")
            if (!res.ok) throw new Error("Failed to fetch suppliers")
            const data = await res.json()
            setSuppliers(data.suppliers || [])
            setError("")
        } catch {
            setError("Failed to load suppliers")
        } finally {
            setLoading(false)
        }
    }

    const handleSendInvitation = async (supplierId: string, connectAll: boolean = false) => {
        setInvitingId(supplierId)
        setError("")
        setShowInviteModal(false)
        try {
            const res = await fetch(`/api/vendors/suppliers/${supplierId}/invite`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    connectToAllStores: connectAll
                })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.message || "Failed to send invitation")
            
            const message = connectAll && data.storesConnected > 1
                ? `Invitations sent successfully to ${data.storesConnected} store(s)! The supplier will receive an email with invitation tokens.`
                : "Invitation sent successfully! The supplier will receive an email with an invitation token."
            
            setSuccess(message)
            fetchSuppliers() // Refresh to update connection status
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to send invitation")
        } finally {
            setInvitingId(null)
            setSelectedSupplierId(null)
            setConnectToAllStores(false)
        }
    }

    const openInviteModal = (supplierId: string) => {
        setSelectedSupplierId(supplierId)
        setShowInviteModal(true)
    }

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

    const filteredSuppliers = suppliers.filter((supplier) =>
        supplier.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        supplier.description?.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">Global Suppliers</h1>
                <p className="text-sm md:text-base text-slate-400 mt-1">Connect with suppliers from around the world.</p>
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

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                    type="text"
                    placeholder="Search suppliers by name or description..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full h-12 bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50"
                />
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
                </div>
            ) : filteredSuppliers.length === 0 ? (
                <div className="bg-white/5 rounded-xl p-12 border border-white/10 text-center">
                    <Package className="w-12 h-12 text-slate-400 mx-auto mb-4 opacity-50" />
                    <p className="text-slate-400 font-medium">
                        {searchTerm ? "No suppliers found matching your search" : "No suppliers available yet"}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                    {filteredSuppliers.map((supplier) => (
                        <div
                            key={supplier.id}
                            className="bg-white/5 rounded-xl p-4 sm:p-6 border border-white/10 hover:border-white/20 transition-colors"
                        >
                            <div className="flex items-start justify-between gap-2 mb-4">
                                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center flex-shrink-0">
                                        <Building2 className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-400" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h3 className="font-bold text-white text-sm sm:text-base truncate">{supplier.companyName}</h3>
                                        {supplier.user.name && (
                                            <p className="text-xs text-slate-400 truncate">{supplier.user.name}</p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex-shrink-0">
                                    {getStatusBadge(supplier.connectionStatus)}
                                </div>
                            </div>

                            {supplier.description && (
                                <p className="text-sm text-slate-300 mb-4 line-clamp-2">{supplier.description}</p>
                            )}

                            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mb-4">
                                <div className="flex items-center gap-1">
                                    <Package className="w-4 h-4 flex-shrink-0" />
                                    <span>{supplier._count.products} products</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <Users className="w-4 h-4 flex-shrink-0" />
                                    <span>{supplier._count.connections} connections</span>
                                </div>
                                {supplier.user.email && (
                                    <div className="flex items-center gap-1 min-w-0">
                                        <Mail className="w-4 h-4 flex-shrink-0" />
                                        <span className="truncate">{supplier.user.email}</span>
                                    </div>
                                )}
                            </div>

                            {supplier.connectionStatus === "NONE" && (
                                <button
                                    onClick={() => openInviteModal(supplier.id)}
                                    disabled={invitingId === supplier.id}
                                    className="w-full px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {invitingId === supplier.id ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Sending...
                                        </>
                                    ) : (
                                        <>
                                            <Mail className="w-4 h-4" />
                                            Send Invitation
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Invite Modal */}
            {showInviteModal && selectedSupplierId && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div
                        className={cn(
                            "rounded-xl p-6 max-w-md w-full border transition-colors",
                            isLight
                                ? "bg-white border-slate-200 shadow-xl"
                                : "bg-slate-800 border-white/10"
                        )}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-white">Send Invitation</h3>
                            <button
                                onClick={() => {
                                    setShowInviteModal(false)
                                    setSelectedSupplierId(null)
                                    setConnectToAllStores(false)
                                }}
                                className="text-slate-400 hover:text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        
                        <p className="text-sm text-slate-300 mb-6">
                            Choose how you want to connect with this supplier:
                        </p>

                        <div className="space-y-4">
                            <label
                                className={cn(
                                    "flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors",
                                    isLight
                                        ? "bg-slate-50 border-slate-200 hover:bg-slate-100"
                                        : "bg-white/5 border-white/10 hover:bg-white/10"
                                )}
                            >
                                <input
                                    type="radio"
                                    name="connectOption"
                                    checked={!connectToAllStores}
                                    onChange={() => setConnectToAllStores(false)}
                                    className="mt-1"
                                />
                                <div className="flex-1">
                                    <div className="font-medium text-white mb-1">Current Store Only</div>
                                    <div className="text-xs text-slate-400">Connect to your active store only</div>
                                </div>
                            </label>

                            <label
                                className={cn(
                                    "flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors",
                                    isLight
                                        ? "bg-slate-50 border-slate-200 hover:bg-slate-100"
                                        : "bg-white/5 border-white/10 hover:bg-white/10"
                                )}
                            >
                                <input
                                    type="radio"
                                    name="connectOption"
                                    checked={connectToAllStores}
                                    onChange={() => setConnectToAllStores(true)}
                                    className="mt-1"
                                />
                                <div className="flex-1">
                                    <div className="font-medium text-white mb-1 flex items-center gap-2">
                                        <Store className="w-4 h-4" />
                                        All My Stores
                                    </div>
                                    <div className="text-xs text-slate-400">Connect to all your stores at once</div>
                                </div>
                            </label>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => {
                                    setShowInviteModal(false)
                                    setSelectedSupplierId(null)
                                    setConnectToAllStores(false)
                                }}
                                className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleSendInvitation(selectedSupplierId, connectToAllStores)}
                                disabled={invitingId === selectedSupplierId}
                                className="flex-1 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {invitingId === selectedSupplierId ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Sending...
                                    </>
                                ) : (
                                    <>
                                        <Mail className="w-4 h-4" />
                                        Send Invitation
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
