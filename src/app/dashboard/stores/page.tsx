"use client"

import { useEffect, useState } from "react"
import { Store, Plus, Check, Loader2, AlertCircle, Building2, Trash2 } from "lucide-react"
import AddStoreModal from "@/components/AddStoreModal"
import DeleteStoreModal from "@/components/DeleteStoreModal"

interface StoreData {
    id: string
    businessName: string
    shopifyDomain: string
    isActive: boolean
    onboardingComplete: boolean
    createdAt: string
}

export default function StoresPage() {
    const [stores, setStores] = useState<StoreData[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState("")
    const [switching, setSwitching] = useState<string | null>(null)
    const [isAddModalOpen, setIsAddModalOpen] = useState(false)
    const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; storeId: string | null; storeName: string; isActive: boolean }>({
        isOpen: false,
        storeId: null,
        storeName: "",
        isActive: false
    })

    useEffect(() => {
        fetchStores()
    }, [])

    const fetchStores = async () => {
        try {
            const res = await fetch("/api/stores")
            if (!res.ok) throw new Error("Failed to fetch stores")
            const data = await res.json()
            setStores(data.stores || [])
        } catch {
            setError("Could not load stores")
        } finally {
            setLoading(false)
        }
    }

    const handleSwitchStore = async (storeId: string) => {
        setSwitching(storeId)
        try {
            const res = await fetch("/api/stores/switch", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ storeId })
            })

            if (!res.ok) {
                const data = await res.json().catch(() => ({ message: "Failed to switch store" }))
                alert(data.message || "Failed to switch store. Please ensure the store has valid Shopify credentials.")
                setSwitching(null)
                return
            }

            // Refresh the page to reload data for the new active store
            window.location.reload()
        } catch (err) {
            console.error("Switch store error:", err)
            alert("An error occurred while switching stores. Please try again.")
            setSwitching(null)
        }
    }

    const handleAddStore = () => {
        setIsAddModalOpen(true)
    }

    const handleStoreAdded = () => {
        fetchStores()
        // Notify StoreSwitcher to refresh
        window.dispatchEvent(new CustomEvent("storeUpdated"))
    }

    const handleDeleteClick = (store: StoreData) => {
        setDeleteModal({
            isOpen: true,
            storeId: store.id,
            storeName: store.businessName,
            isActive: store.isActive
        })
    }

    const handleDeleteConfirm = async () => {
        if (!deleteModal.storeId) return

        try {
            const res = await fetch(`/api/stores/${deleteModal.storeId}`, {
                method: "DELETE"
            })

            if (!res.ok) {
                const data = await res.json().catch(() => ({ message: "Failed to delete store" }))
                throw new Error(data.message || "Failed to delete store")
            }

            // Refresh stores list
            await fetchStores()
            
            // Notify StoreSwitcher to refresh
            window.dispatchEvent(new CustomEvent("storeUpdated"))
            
            // If deleted store was active, reload page to refresh dashboard data
            if (deleteModal.isActive) {
                window.location.reload()
            }
        } catch (err) {
            throw err
        }
    }

    return (
        <div className="space-y-4 md:space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">Stores</h1>
                    <p className="text-sm md:text-base text-slate-400 mt-1">Manage your connected Shopify stores.</p>
                </div>
                <button
                    onClick={handleAddStore}
                    className="h-10 md:h-11 px-4 md:px-6 bg-indigo-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-600 border border-indigo-400/20 transition-all text-sm shrink-0"
                >
                    <Plus className="w-4 h-4" />
                    <span className="hidden sm:inline">Add Store</span>
                </button>
            </div>

            {loading ? (
                <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
                    <p className="font-medium">Loading stores...</p>
                </div>
            ) : error ? (
                <div className="h-64 flex flex-col items-center justify-center text-red-400 gap-4">
                    <AlertCircle className="w-8 h-8" />
                    <p className="font-bold">{error}</p>
                </div>
            ) : stores.length === 0 ? (
                <div className="bg-white/5 backdrop-blur-xl rounded-xl md:rounded-2xl border border-white/10 p-8 md:p-12">
                    <div className="flex flex-col items-center justify-center text-center gap-4">
                        <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-white/10 border border-white/10 flex items-center justify-center">
                            <Building2 className="w-7 h-7 md:w-8 md:h-8 text-slate-400" />
                        </div>
                        <div>
                            <h3 className="text-base md:text-lg font-bold text-white">No Stores Connected</h3>
                            <p className="text-xs md:text-sm text-slate-400 mt-1">
                                Connect your first Shopify store to get started.
                            </p>
                        </div>
                        <button
                            onClick={handleAddStore}
                            className="mt-4 h-10 md:h-11 px-5 md:px-6 bg-indigo-500 text-white rounded-xl font-bold hover:bg-indigo-600 border border-indigo-400/20 transition-all text-sm md:text-base"
                        >
                            Connect Store
                        </button>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                    {stores.map((store) => (
                        <div
                            key={store.id}
                            className={`bg-white/5 backdrop-blur-xl p-4 md:p-6 rounded-xl md:rounded-2xl border transition-all group relative ${store.isActive
                                ? "border-indigo-500/30 bg-indigo-500/10"
                                : "border-white/10 hover:bg-white/[0.07]"
                                }`}
                        >
                            <div className="flex items-start justify-between mb-3 md:mb-4">
                                <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg md:rounded-xl bg-indigo-500/20 border border-indigo-400/20 flex items-center justify-center shrink-0">
                                    <Store className="w-5 h-5 md:w-6 md:h-6 text-indigo-400" />
                                </div>
                                {store.isActive && (
                                    <span className="px-2 md:px-2.5 py-1 bg-indigo-500/30 text-indigo-300 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-wider flex items-center gap-1 border border-indigo-400/20">
                                        <Check className="w-2.5 h-2.5 md:w-3 md:h-3" />
                                        Active
                                    </span>
                                )}
                            </div>

                            <div className="space-y-1.5 md:space-y-2 mb-3 md:mb-4">
                                <h3 className="text-base md:text-lg font-black text-white truncate">{store.businessName}</h3>
                                <p className="text-xs text-slate-400 font-medium truncate">{store.shopifyDomain}</p>
                                <p className="text-[10px] text-slate-500">
                                    Connected {new Date(store.createdAt).toLocaleDateString()}
                                </p>
                            </div>

                            <div className="flex items-center justify-between gap-2">
                                {!store.isActive ? (
                                    <button
                                        onClick={() => handleSwitchStore(store.id)}
                                        disabled={switching === store.id}
                                        className="flex-1 h-9 md:h-10 rounded-xl bg-white/10 text-white text-xs md:text-sm font-bold hover:bg-white/15 border border-white/10 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {switching === store.id ? (
                                            <>
                                                <Loader2 className="w-3.5 h-3.5 md:w-4 md:h-4 animate-spin" />
                                                Switching...
                                            </>
                                        ) : (
                                            "Switch to this store"
                                        )}
                                    </button>
                                ) : (
                                    <div className="flex-1" />
                                )}
                                <button
                                    onClick={() => handleDeleteClick(store)}
                                    className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-white/10 hover:bg-red-500/20 border border-white/10 hover:border-red-500/30 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 shrink-0"
                                    title="Delete store"
                                    aria-label="Delete store"
                                >
                                    <Trash2 className="w-4 h-4 md:w-5 md:h-5 text-slate-400 group-hover:text-red-400 transition-colors" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <AddStoreModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onSuccess={handleStoreAdded}
            />

            <DeleteStoreModal
                isOpen={deleteModal.isOpen}
                onClose={() => setDeleteModal({ isOpen: false, storeId: null, storeName: "", isActive: false })}
                onConfirm={handleDeleteConfirm}
                storeName={deleteModal.storeName}
                isActive={deleteModal.isActive}
            />
        </div>
    )
}
