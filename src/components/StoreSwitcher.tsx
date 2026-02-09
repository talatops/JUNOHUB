"use client"

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Store, ChevronDown, Check, Settings } from "lucide-react"
import { useRouter } from "next/navigation"

interface StoreData {
    id: string
    businessName: string
    shopifyDomain: string
    isActive: boolean
}

export default function StoreSwitcher() {
    const router = useRouter()
    const [stores, setStores] = useState<StoreData[]>([])
    const [isOpen, setIsOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        fetchStores()
        
        // Listen for store updates (when stores are added/deleted)
        const handleStoreUpdate = () => {
            fetchStores()
        }
        
        window.addEventListener("storeUpdated", handleStoreUpdate)
        
        return () => {
            window.removeEventListener("storeUpdated", handleStoreUpdate)
        }
    }, [])

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside)
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside)
        }
    }, [isOpen])

    const fetchStores = async () => {
        try {
            const res = await fetch("/api/stores")
            if (res.ok) {
                const data = await res.json()
                setStores(data.stores || [])
            }
        } catch (err) {
            console.error("Failed to fetch stores:", err)
        }
    }

    const activeStore = stores.find(s => s.isActive)

    const handleSwitch = async (storeId: string) => {
        if (loading) return

        setLoading(true)
        try {
            const res = await fetch("/api/stores/switch", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ storeId })
            })

            if (res.ok) {
                window.location.reload()
            }
        } catch (err) {
            console.error("Failed to switch store:", err)
        } finally {
            setLoading(false)
        }
    }

    if (stores.length === 0) return null

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-1.5 md:gap-2 px-2 md:px-4 py-2 bg-white/10 border border-white/10 rounded-xl hover:bg-white/15 backdrop-blur-sm transition-all duration-200 ease-out text-left max-w-full"
            >
                <Store className="w-3.5 h-3.5 md:w-4 md:h-4 text-slate-300 shrink-0" />
                <div className="flex flex-col items-start min-w-0 flex-1">
                    <span className="hidden md:block text-xs text-slate-400 font-medium">Store</span>
                    <span className="text-xs md:text-sm font-bold text-white truncate max-w-[100px] md:max-w-none">
                        {activeStore?.businessName || "Select Store"}
                    </span>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 md:w-4 md:h-4 text-slate-400 transition-transform duration-200 ease-out shrink-0 ${isOpen ? "rotate-180" : ""}`} />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            className="fixed inset-0 z-40"
                            onClick={() => setIsOpen(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, y: -8, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -8, scale: 0.95 }}
                            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                            className="absolute left-0 md:left-auto md:right-0 mt-2 w-[calc(100vw-2rem)] md:w-72 max-w-[320px] bg-slate-900/90 border border-white/10 rounded-2xl shadow-2xl z-[110] overflow-hidden backdrop-blur-xl"
                        >
                        <div className="p-3 border-b border-white/10 bg-white/5">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Your Stores</p>
                        </div>
                        <div className="max-h-80 overflow-y-auto">
                            {stores.map((store) => (
                                <button
                                    key={store.id}
                                    onClick={() => {
                                        if (!store.isActive) {
                                            handleSwitch(store.id)
                                        }
                                        setIsOpen(false)
                                    }}
                                    disabled={loading}
                                    className={`w-full px-4 py-3 flex items-center justify-between hover:bg-white/10 transition-all ${store.isActive ? "bg-indigo-500/20" : ""}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${store.isActive ? "bg-indigo-500/50 border border-indigo-400/30" : "bg-white/10"}`}>
                                            <Store className={`w-4 h-4 ${store.isActive ? "text-indigo-300" : "text-slate-400"}`} />
                                        </div>
                                        <div className="flex flex-col items-start">
                                            <span className="text-sm font-bold text-white">{store.businessName}</span>
                                            <span className="text-xs text-slate-400">{store.shopifyDomain}</span>
                                        </div>
                                    </div>
                                    {store.isActive && (
                                        <Check className="w-4 h-4 text-indigo-400" />
                                    )}
                                </button>
                            ))}
                        </div>
                        <div className="p-3 border-t border-white/10 bg-white/5">
                            <button
                                onClick={() => {
                                    setIsOpen(false)
                                    router.push("/dashboard/stores")
                                }}
                                className="w-full h-9 rounded-lg bg-white/10 text-white text-sm font-bold hover:bg-white/15 border border-white/10 transition-all flex items-center justify-center gap-2"
                            >
                                <Settings className="w-4 h-4" />
                                Manage Stores
                            </button>
                        </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    )
}
