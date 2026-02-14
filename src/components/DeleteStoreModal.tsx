"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, AlertTriangle, Loader2, Trash2 } from "lucide-react"
import { useTheme } from "@/components/ThemeProvider"

interface DeleteStoreModalProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: () => Promise<void>
    storeName: string
    isActive: boolean
}

export default function DeleteStoreModal({
    isOpen,
    onClose,
    onConfirm,
    storeName,
    isActive
}: DeleteStoreModalProps) {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")
    const { theme } = useTheme()
    const isLight = theme === "light"

    const handleDelete = async () => {
        setLoading(true)
        setError("")
        try {
            await onConfirm()
            onClose()
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to delete store"
            setError(message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
                    />

                    {/* Modal */}
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className={`rounded-2xl shadow-2xl w-full max-w-md overflow-hidden pointer-events-auto ${isLight
                                    ? "bg-white"
                                    : "bg-slate-900/95 backdrop-blur-xl border border-white/10"
                                }`}
                        >
                            {/* Header */}
                            <div className={`p-6 border-b ${isLight ? "border-slate-100" : "border-white/10"}`}>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isLight ? "bg-red-100" : "bg-red-500/20 border border-red-500/30"
                                            }`}>
                                            <AlertTriangle className={`w-6 h-6 ${isLight ? "text-red-600" : "text-red-400"}`} />
                                        </div>
                                        <div>
                                            <h2 className={`text-xl font-bold ${isLight ? "text-slate-900" : "text-white"}`}>Delete Store</h2>
                                            <p className={`text-sm mt-0.5 ${isLight ? "text-slate-500" : "text-slate-400"}`}>This action cannot be undone</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={onClose}
                                        disabled={loading}
                                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50 ${isLight
                                                ? "bg-slate-100 hover:bg-slate-200 text-slate-600"
                                                : "bg-white/10 hover:bg-white/15 text-slate-400"
                                            }`}
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="p-6">
                                <div className="mb-6">
                                    <p className={`mb-4 ${isLight ? "text-slate-700" : "text-slate-300"}`}>
                                        Are you sure you want to delete <span className={`font-bold ${isLight ? "text-slate-900" : "text-white"}`}>{storeName}</span>?
                                    </p>
                                    {isActive && (
                                        <div className={`p-4 rounded-xl border mb-4 ${isLight
                                                ? "bg-amber-50 border-amber-200"
                                                : "bg-amber-500/10 border-amber-500/20"
                                            }`}>
                                            <div className="flex items-start gap-3">
                                                <AlertTriangle className={`w-5 h-5 shrink-0 mt-0.5 ${isLight ? "text-amber-600" : "text-amber-400"}`} />
                                                <div>
                                                    <p className={`text-sm font-bold mb-1 ${isLight ? "text-amber-900" : "text-amber-300"}`}>Active Store</p>
                                                    <p className={`text-sm ${isLight ? "text-amber-700" : "text-amber-400/80"}`}>
                                                        This is your active store. We&apos;ll automatically switch to another store after deletion.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    <div className={`p-4 rounded-xl border ${isLight
                                            ? "bg-slate-50 border-slate-200"
                                            : "bg-white/5 border-white/10"
                                        }`}>
                                        <p className={`text-sm ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                                            This will permanently delete:
                                        </p>
                                        <ul className={`mt-2 space-y-1 text-sm ml-4 list-disc ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                                            <li>Store configuration and credentials</li>
                                            <li>All cached products, orders, and customers</li>
                                            <li>Sync metadata and webhook connections</li>
                                        </ul>
                                    </div>
                                </div>

                                {error && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className={`mb-4 p-4 rounded-xl border flex items-start gap-3 ${isLight
                                                ? "bg-red-50 border-red-200"
                                                : "bg-red-500/10 border-red-500/20"
                                            }`}
                                    >
                                        <AlertTriangle className={`w-5 h-5 shrink-0 mt-0.5 ${isLight ? "text-red-600" : "text-red-400"}`} />
                                        <p className={`text-sm ${isLight ? "text-red-700" : "text-red-400"}`}>{error}</p>
                                    </motion.div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className={`p-6 border-t flex items-center justify-end gap-3 ${isLight ? "border-slate-100" : "border-white/10"
                                }`}>
                                <button
                                    onClick={onClose}
                                    disabled={loading}
                                    className={`h-11 px-6 rounded-xl font-bold transition-all disabled:opacity-50 ${isLight
                                            ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                                            : "bg-white/10 text-slate-300 hover:bg-white/15"
                                        }`}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDelete}
                                    disabled={loading}
                                    className="h-11 px-6 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all disabled:opacity-50 flex items-center gap-2"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Deleting...
                                        </>
                                    ) : (
                                        <>
                                            <Trash2 className="w-4 h-4" />
                                            Delete Store
                                        </>
                                    )}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    )
}
