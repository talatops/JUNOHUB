"use client"

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Store, ChevronDown, Check, Settings } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTheme } from "@/components/ThemeProvider"

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
    const { theme } = useTheme()
    const isLight = theme === "light"

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

    if (stores.length === 0) {
        return (
            <button
                type="button"
                onClick={() => router.push("/dashboard/stores")}
                className={`flex max-w-full items-center gap-1.5 rounded-xl border px-2 py-2 text-left backdrop-blur-sm transition-all duration-200 ease-out md:gap-2 md:px-4 ${isLight
                    ? "bg-white border-slate-200 hover:bg-slate-50"
                    : "bg-white/10 border-white/10 hover:bg-white/15"
                    }`}
            >
                <Store
                    className={`h-3.5 w-3.5 shrink-0 md:h-4 md:w-4 ${isLight ? "text-slate-600" : "text-slate-300"}`}
                />
                <span
                    className={`truncate text-xs font-bold md:text-sm ${isLight ? "text-slate-900" : "text-white"}`}
                >
                    Stores
                </span>
            </button>
        )
    }

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex max-w-full items-center gap-1.5 rounded-xl border px-2 py-2 text-left backdrop-blur-sm transition-all duration-200 ease-out md:gap-2 md:px-4 ${isLight
                        ? "bg-white border-slate-200 hover:bg-slate-50"
                        : "bg-white/10 border-white/10 hover:bg-white/15"
                    }`}
            >
                <Store
                    className={`h-3.5 w-3.5 shrink-0 md:h-4 md:w-4 ${isLight ? "text-slate-600" : "text-slate-300"
                        }`}
                />
                <div className="flex min-w-0 flex-1 flex-col items-start">
                    <span
                        className={`hidden text-xs font-medium md:block ${isLight ? "text-slate-500" : "text-slate-400"
                            }`}
                    >
                        Store
                    </span>
                    <span
                        className={`truncate text-xs font-bold md:text-sm md:max-w-none max-w-[80px] xs:max-w-[120px] ${isLight ? "text-slate-900" : "text-white"
                            }`}
                    >
                        {activeStore?.businessName || "Select Store"}
                    </span>
                </div>
                <ChevronDown
                    className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ease-out md:h-4 md:w-4 ${isLight ? "text-slate-500" : "text-slate-400"
                        } ${isOpen ? "rotate-180" : ""}`}
                />
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
                            className={`absolute left-0 z-[110] mt-2 max-w-[320px] overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-xl md:left-auto md:right-0 w-[calc(100vw-2rem)] md:w-72 ${isLight
                                    ? "bg-white border-slate-200"
                                    : "bg-slate-900/90 border-white/10"
                                }`}
                        >
                            <div
                                className={`p-3 border-b ${isLight ? "bg-slate-50 border-slate-200" : "bg-white/5 border-white/10"
                                    }`}
                            >
                                <p
                                    className={`text-xs font-bold uppercase tracking-wider ${isLight ? "text-slate-500" : "text-slate-400"
                                        }`}
                                >
                                    Your Stores
                                </p>
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
                                        className={`flex w-full items-center justify-between px-4 py-3 transition-all ${isLight
                                                ? "hover:bg-slate-50"
                                                : "hover:bg-white/10"
                                            } ${store.isActive
                                                ? isLight
                                                    ? "bg-indigo-50"
                                                    : "bg-indigo-500/20"
                                                : ""
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div
                                                className={`flex h-8 w-8 items-center justify-center rounded-lg ${store.isActive
                                                        ? isLight
                                                            ? "bg-indigo-100 border border-indigo-300"
                                                            : "bg-indigo-500/50 border border-indigo-400/30"
                                                        : isLight
                                                            ? "bg-slate-100"
                                                            : "bg-white/10"
                                                    }`}
                                            >
                                                <Store
                                                    className={`h-4 w-4 ${store.isActive
                                                            ? isLight
                                                                ? "text-indigo-600"
                                                                : "text-indigo-300"
                                                            : isLight
                                                                ? "text-slate-500"
                                                                : "text-slate-400"
                                                        }`}
                                                />
                                            </div>
                                            <div className="flex flex-col items-start">
                                                <span
                                                    className={`text-sm font-bold ${isLight
                                                            ? "text-slate-900"
                                                            : "text-white"
                                                        }`}
                                                >
                                                    {store.businessName}
                                                </span>
                                                <span
                                                    className={`text-xs ${isLight
                                                            ? "text-slate-500"
                                                            : "text-slate-400"
                                                        }`}
                                                >
                                                    {store.shopifyDomain}
                                                </span>
                                            </div>
                                        </div>
                                        {store.isActive && (
                                            <Check
                                                className={`h-4 w-4 ${isLight
                                                        ? "text-indigo-600"
                                                        : "text-indigo-400"
                                                    }`}
                                            />
                                        )}
                                    </button>
                                ))}
                            </div>
                            <div
                                className={`p-3 border-t ${isLight ? "bg-slate-50 border-slate-200" : "bg-white/5 border-white/10"
                                    }`}
                            >
                                <button
                                    onClick={() => {
                                        setIsOpen(false)
                                        router.push("/dashboard/stores")
                                    }}
                                    className={`flex h-9 w-full items-center justify-center gap-2 rounded-lg text-sm font-bold transition-all border ${isLight
                                            ? "bg-indigo-600 text-white border-indigo-500 hover:bg-indigo-500"
                                            : "bg-white/10 text-white border-white/10 hover:bg-white/15"
                                        }`}
                                >
                                    <Settings className="h-4 w-4" />
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
