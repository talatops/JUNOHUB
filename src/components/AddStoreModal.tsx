"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
    X,
    Globe,
    Key,
    Loader2,
    AlertCircle,
    Cloud,
    CheckCircle2
} from "lucide-react"

interface AddStoreModalProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
}

export default function AddStoreModal({ isOpen, onClose, onSuccess }: AddStoreModalProps) {
    const [step, setStep] = useState(1)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")
    const [success, setSuccess] = useState(false)

    const [formData, setFormData] = useState({
        businessName: "",
        storeName: "",
        domain: "",
        apiKey: "",
        apiSecret: "",
        accessToken: "",
    })

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value })
    }

    const validateStep = () => {
        if (step === 1) {
            if (!formData.businessName || !formData.storeName || !formData.domain) {
                setError("Please fill in all store details")
                return false
            }
        }
        if (step === 2) {
            if (!formData.apiKey || !formData.apiSecret || !formData.accessToken) {
                setError("Please provide all Shopify credentials")
                return false
            }
        }
        setError("")
        return true
    }

    const nextStep = () => {
        if (validateStep()) setStep(step + 1)
    }

    const prevStep = () => {
        setStep(step - 1)
        setError("")
    }

    const handleSubmit = async () => {
        if (!validateStep()) return
        setLoading(true)
        setError("")

        try {
            const res = await fetch("/api/onboarding/shopify", {
                method: "POST",
                body: JSON.stringify(formData),
                headers: { "Content-Type": "application/json" },
            })

            if (res.ok) {
                const storeData = await res.json()
                const storeId = storeData.store?.id

                // Register webhooks for the new store
                if (storeId) {
                    try {
                        await fetch(`/api/stores/${storeId}/webhooks`, {
                            method: "POST"
                        })
                    } catch (webhookError) {
                        console.error("Failed to register webhooks:", webhookError)
                        // Don't fail the whole operation if webhook registration fails
                    }
                }

                setSuccess(true)
                setTimeout(() => {
                    setSuccess(false)
                    setStep(1)
                    setFormData({
                        businessName: "",
                        storeName: "",
                        domain: "",
                        apiKey: "",
                        apiSecret: "",
                        accessToken: "",
                    })
                    onSuccess()
                    onClose()
                }, 1500)
            } else {
                const data = await res.json()
                setError(data.message || "Failed to save store credentials")
            }
        } catch {
            setError("An error occurred. Please verify your connection.")
        } finally {
            setLoading(false)
        }
    }

    const handleClose = () => {
        if (!loading && !success) {
            setStep(1)
            setError("")
            setFormData({
                businessName: "",
                storeName: "",
                domain: "",
                apiKey: "",
                apiSecret: "",
                accessToken: "",
            })
            onClose()
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
                        onClick={handleClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
                    />

                    {/* Modal */}
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-slate-900/95 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden pointer-events-auto flex flex-col"
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between p-6 border-b border-white/10">
                                <div>
                                    <h2 className="text-2xl font-bold text-white">Add New Store</h2>
                                    <p className="text-sm text-slate-400 mt-1">Connect a Shopify store to your account</p>
                                </div>
                                <button
                                    onClick={handleClose}
                                    disabled={loading || success}
                                    className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/15 flex items-center justify-center transition-colors disabled:opacity-50 text-slate-300"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Progress Bar */}
                            <div className="px-6 pt-6">
                                <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-2 uppercase tracking-wider">
                                    <span className={step >= 1 ? "text-indigo-400" : ""}>Store Details</span>
                                    <span className={step >= 2 ? "text-indigo-400" : ""}>API Credentials</span>
                                    <span className={step >= 3 ? "text-indigo-400" : ""}>Complete</span>
                                </div>
                                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                                    <motion.div
                                        initial={{ width: "0%" }}
                                        animate={{ width: `${(step / 3) * 100}%` }}
                                        className="h-full bg-indigo-500 transition-all duration-500"
                                    />
                                </div>
                            </div>

                            {/* Content */}
                            <div className="flex-1 overflow-y-auto p-6">
                                <AnimatePresence mode="wait">
                                    {success ? (
                                        <motion.div
                                            key="success"
                                            initial={{ scale: 0.9, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            className="flex flex-col items-center justify-center py-12 text-center"
                                        >
                                            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center mb-4">
                                                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                                            </div>
                                            <h3 className="text-xl font-bold text-white mb-2">Store Added Successfully!</h3>
                                            <p className="text-slate-400">Your store has been connected and is ready to use.</p>
                                        </motion.div>
                                    ) : step === 1 ? (
                                        <motion.div
                                            key="step1"
                                            initial={{ x: 20, opacity: 0 }}
                                            animate={{ x: 0, opacity: 1 }}
                                            exit={{ x: -20, opacity: 0 }}
                                            className="space-y-6"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-xl bg-indigo-500/20 border border-indigo-400/20 flex items-center justify-center">
                                                    <Globe className="w-6 h-6 text-indigo-400" />
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-bold text-white">Store Information</h3>
                                                    <p className="text-sm text-slate-400">Enter your store details</p>
                                                </div>
                                            </div>

                                            <div className="space-y-4">
                                                <div>
                                                    <label className="block text-sm font-bold text-slate-300 mb-2">
                                                        Business Name <span className="text-red-400">*</span>
                                                    </label>
                                                    <input
                                                        name="businessName"
                                                        value={formData.businessName}
                                                        onChange={handleInputChange}
                                                        placeholder="e.g. My Store"
                                                        className="w-full h-12 px-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 transition-all"
                                                    />
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-sm font-bold text-slate-300 mb-2">
                                                            Shopify Store Name <span className="text-red-400">*</span>
                                                        </label>
                                                        <input
                                                            name="storeName"
                                                            value={formData.storeName}
                                                            onChange={handleInputChange}
                                                            placeholder="my-store"
                                                            className="w-full h-12 px-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 transition-all"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-bold text-slate-300 mb-2">
                                                            Domain <span className="text-red-400">*</span>
                                                        </label>
                                                        <input
                                                            name="domain"
                                                            value={formData.domain}
                                                            onChange={handleInputChange}
                                                            placeholder="my-store.myshopify.com"
                                                            className="w-full h-12 px-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 transition-all"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </motion.div>
                                    ) : step === 2 ? (
                                        <motion.div
                                            key="step2"
                                            initial={{ x: 20, opacity: 0 }}
                                            animate={{ x: 0, opacity: 1 }}
                                            exit={{ x: -20, opacity: 0 }}
                                            className="space-y-6"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-xl bg-indigo-500/20 border border-indigo-400/20 flex items-center justify-center">
                                                    <Key className="w-6 h-6 text-indigo-400" />
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-bold text-white">API Credentials</h3>
                                                    <p className="text-sm text-slate-400">Provide your Shopify Admin API credentials</p>
                                                </div>
                                            </div>

                                            <div className="space-y-4">
                                                <div>
                                                    <label className="block text-sm font-bold text-slate-300 mb-2">
                                                        Admin API Key <span className="text-red-400">*</span>
                                                    </label>
                                                    <input
                                                        name="apiKey"
                                                        type="password"
                                                        value={formData.apiKey}
                                                        onChange={handleInputChange}
                                                        placeholder="Enter API Key"
                                                        className="w-full h-12 px-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 transition-all"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-bold text-slate-300 mb-2">
                                                        Admin API Secret <span className="text-red-400">*</span>
                                                    </label>
                                                    <input
                                                        name="apiSecret"
                                                        type="password"
                                                        value={formData.apiSecret}
                                                        onChange={handleInputChange}
                                                        placeholder="Enter API Secret"
                                                        className="w-full h-12 px-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 transition-all"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-bold text-slate-300 mb-2">
                                                        Access Token <span className="text-red-400">*</span>
                                                    </label>
                                                    <input
                                                        name="accessToken"
                                                        type="password"
                                                        value={formData.accessToken}
                                                        onChange={handleInputChange}
                                                        placeholder="shpat_..."
                                                        className="w-full h-12 px-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 transition-all"
                                                    />
                                                </div>
                                            </div>
                                        </motion.div>
                                    ) : (
                                        <motion.div
                                            key="step3"
                                            initial={{ x: 20, opacity: 0 }}
                                            animate={{ x: 0, opacity: 1 }}
                                            exit={{ x: -20, opacity: 0 }}
                                            className="flex flex-col items-center justify-center py-8 text-center"
                                        >
                                            <div className="w-16 h-16 rounded-full bg-indigo-500/20 border border-indigo-400/20 flex items-center justify-center mb-4 relative">
                                                <Cloud className={`w-8 h-8 ${loading ? "text-indigo-400 animate-pulse" : "text-indigo-400"}`} />
                                                {loading && (
                                                    <motion.div
                                                        animate={{ rotate: 360 }}
                                                        transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                                                        className="absolute inset-0 border-2 border-indigo-500 border-t-transparent rounded-full"
                                                    />
                                                )}
                                            </div>
                                            <h3 className="text-lg font-bold text-white mb-2">Connecting Store</h3>
                                            <p className="text-sm text-slate-400 max-w-sm">
                                                We&apos;re connecting your store and setting up the integration...
                                            </p>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {error && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3"
                                    >
                                        <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                                        <p className="text-sm text-red-400">{error}</p>
                                    </motion.div>
                                )}
                            </div>

                            {/* Footer */}
                            {!success && (
                                <div className="p-6 border-t border-white/10 flex items-center justify-between gap-4">
                                    <button
                                        onClick={prevStep}
                                        disabled={step === 1 || loading}
                                        className="h-11 px-6 bg-white/10 text-slate-300 rounded-xl font-bold hover:bg-white/15 border border-white/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Back
                                    </button>
                                    {step < 3 ? (
                                        <button
                                            onClick={nextStep}
                                            disabled={loading}
                                            className="h-11 px-6 bg-indigo-500 text-white rounded-xl font-bold hover:bg-indigo-600 border border-indigo-400/20 transition-all disabled:opacity-50 flex items-center gap-2 ml-auto"
                                        >
                                            Continue
                                        </button>
                                    ) : (
                                        <button
                                            onClick={handleSubmit}
                                            disabled={loading}
                                            className="h-11 px-6 bg-indigo-500 text-white rounded-xl font-bold hover:bg-indigo-600 border border-indigo-400/20 transition-all disabled:opacity-50 flex items-center gap-2 ml-auto"
                                        >
                                            {loading ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                    Connecting...
                                                </>
                                            ) : (
                                                "Connect Store"
                                            )}
                                        </button>
                                    )}
                                </div>
                            )}
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    )
}
