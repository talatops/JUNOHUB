"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, AlertTriangle, Loader2, Trash2 } from "lucide-react"

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
                            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden pointer-events-auto"
                        >
                            {/* Header */}
                            <div className="p-6 border-b border-slate-100">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center">
                                            <AlertTriangle className="w-6 h-6 text-red-600" />
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-bold text-slate-900">Delete Store</h2>
                                            <p className="text-sm text-slate-500 mt-0.5">This action cannot be undone</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={onClose}
                                        disabled={loading}
                                        className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors disabled:opacity-50"
                                    >
                                        <X className="w-4 h-4 text-slate-600" />
                                    </button>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="p-6">
                                <div className="mb-6">
                                    <p className="text-slate-700 mb-4">
                                        Are you sure you want to delete <span className="font-bold text-slate-900">{storeName}</span>?
                                    </p>
                                    {isActive && (
                                        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 mb-4">
                                            <div className="flex items-start gap-3">
                                                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                                                <div>
                                                    <p className="text-sm font-bold text-amber-900 mb-1">Active Store</p>
                                                    <p className="text-sm text-amber-700">
                                                        This is your active store. We&apos;ll automatically switch to another store after deletion.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                                        <p className="text-sm text-slate-600">
                                            This will permanently delete:
                                        </p>
                                        <ul className="mt-2 space-y-1 text-sm text-slate-600 ml-4 list-disc">
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
                                        className="mb-4 p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3"
                                    >
                                        <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                                        <p className="text-sm text-red-700">{error}</p>
                                    </motion.div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="p-6 border-t border-slate-100 flex items-center justify-end gap-3">
                                <button
                                    onClick={onClose}
                                    disabled={loading}
                                    className="h-11 px-6 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-all disabled:opacity-50"
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
