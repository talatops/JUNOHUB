"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
    Globe,
    Key,
    Loader2,
    AlertCircle,
    Cloud,
    CheckCircle2
} from "lucide-react"
import { useRouter } from "next/navigation"

export default function ShopifyOnboardingPage() {
    const [step, setStep] = useState(1)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")
    const [success, setSuccess] = useState(false)
    const router = useRouter()

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
                setSuccess(true)
                setTimeout(() => {
                    router.push("/dashboard")
                }, 2000)
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

    if (success) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4 dashboard-glass-dark">
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-center space-y-4"
                >
                    <div className="w-20 h-20 rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center mx-auto mb-6">
                        <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                    </div>
                    <h1 className="text-3xl font-bold text-white">Initialization Successful</h1>
                    <p className="text-slate-400">Redirecting to your dashboard control panel...</p>
                </motion.div>
            </div>
        )
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 relative dashboard-glass-dark overflow-hidden">
            {/* Visual background lines (SVG pattern mock) */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
                style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #fff 1px, transparent 0)', backgroundSize: '40px 40px' }}
            />

            <div className="w-full max-w-2xl relative">
                {/* Progress Bar */}
                <div className="mb-12">
                    <div className="flex justify-between text-[10px] font-mono font-bold text-zinc-500 mb-2 px-1 tracking-widest uppercase">
                        <span>01 STORE DETAILS</span>
                        <span>02 API CREDENTIALS</span>
                        <span>03 SYSTEM SYNC</span>
                    </div>
                    <div className="h-1 bg-zinc-900 rounded-full overflow-hidden">
                        <motion.div
                            initial={{ width: "0%" }}
                            animate={{ width: `${(step / 3) * 100}%` }}
                            className="h-full bg-emerald-accent shadow-[0_0_10px_rgba(16,185,129,0.5)] transition-all duration-500"
                        />
                    </div>
                </div>

                <AnimatePresence mode="wait">
                    {step === 1 && (
                        <motion.div
                            key="step1"
                            initial={{ x: 20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: -20, opacity: 0 }}
                            className="glass p-10 rounded-3xl glow-emerald"
                        >
                            <div className="flex items-center gap-4 mb-8">
                                <div className="p-3 bg-emerald-accent/10 rounded-xl text-emerald-accent border border-emerald-accent/20">
                                    <Globe className="w-6 h-6" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-white">Store Identity</h2>
                                    <p className="text-zinc-500 text-sm">Define how your store appears in our network</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2 col-span-2">
                                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider ml-1">Business Public Name</label>
                                    <input
                                        name="businessName"
                                        value={formData.businessName}
                                        onChange={handleInputChange}
                                        placeholder="e.g. Neo Tokyo Electronics"
                                        className="w-full h-12 bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 text-white focus:outline-none focus:border-emerald-accent transition-colors"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider ml-1">Shopify Store Name</label>
                                    <input
                                        name="storeName"
                                        value={formData.storeName}
                                        onChange={handleInputChange}
                                        placeholder="neo-tokyo-shop"
                                        className="w-full h-12 bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 text-white focus:outline-none focus:border-emerald-accent transition-colors"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider ml-1">Store Domain</label>
                                    <input
                                        name="domain"
                                        value={formData.domain}
                                        onChange={handleInputChange}
                                        placeholder="neo-tokyo.myshopify.com"
                                        className="w-full h-12 bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 text-white focus:outline-none focus:border-emerald-accent transition-colors"
                                    />
                                </div>
                            </div>

                            <button
                                onClick={nextStep}
                                className="w-full mt-10 h-14 bg-emerald-accent text-black font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-emerald-600 transition-all group"
                            >
                                INITIALIZE CONNECTION
                                <span className="group-hover:translate-x-1 transition-transform">&rarr;</span>
                            </button>
                        </motion.div>
                    )}

                    {step === 2 && (
                        <motion.div
                            key="step2"
                            initial={{ x: 20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: -20, opacity: 0 }}
                            className="glass p-10 rounded-3xl glow-lime border-lime-accent/20"
                        >
                            <div className="flex items-center gap-4 mb-8">
                                <div className="p-3 bg-lime-accent/10 rounded-xl text-lime-accent border border-lime-accent/20">
                                    <Key className="w-6 h-6" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-white">Access Protocol</h2>
                                    <p className="text-zinc-500 text-sm">Provide your Shopify Admin API credentials</p>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider ml-1">Admin API Key</label>
                                    <input
                                        name="apiKey"
                                        type="password"
                                        value={formData.apiKey}
                                        onChange={handleInputChange}
                                        placeholder="********************************"
                                        className="w-full h-12 bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 text-white focus:outline-none focus:border-lime-accent transition-colors"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider ml-1">Admin API Secret</label>
                                    <input
                                        name="apiSecret"
                                        type="password"
                                        value={formData.apiSecret}
                                        onChange={handleInputChange}
                                        placeholder="********************************"
                                        className="w-full h-12 bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 text-white focus:outline-none focus:border-lime-accent transition-colors"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider ml-1">Access Token (Offline)</label>
                                    <input
                                        name="accessToken"
                                        type="password"
                                        value={formData.accessToken}
                                        onChange={handleInputChange}
                                        placeholder="shpat_********************************"
                                        className="w-full h-12 bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 text-white focus:outline-none focus:border-lime-accent transition-colors"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mt-10">
                                <button
                                    onClick={prevStep}
                                    className="h-14 bg-zinc-900 text-zinc-400 font-bold rounded-xl border border-zinc-800 hover:bg-zinc-800 transition-all"
                                >
                                    RETURN
                                </button>
                                <button
                                    onClick={nextStep}
                                    className="h-14 bg-lime-accent text-black font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-lime-600 transition-all group"
                                >
                                    UPLOAD KEYS
                                    <span className="group-hover:-translate-y-1 transition-transform">^</span>
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {step === 3 && (
                        <motion.div
                            key="step3"
                            initial={{ x: 20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: -20, opacity: 0 }}
                            className="glass p-10 rounded-3xl border-white/5 text-center"
                        >
                            <div className="w-20 h-20 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-6 relative">
                                <Cloud className={`w-10 h-10 ${loading ? 'text-emerald-accent animate-pulse' : 'text-zinc-600'}`} />
                                {loading && (
                                    <motion.div
                                        animate={{ rotate: 360 }}
                                        transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                                        className="absolute inset-0 border-2 border-emerald-accent border-t-transparent rounded-2xl"
                                    />
                                )}
                            </div>
                            <h2 className="text-2xl font-bold text-white mb-2">Sync Infrastructure</h2>
                            <p className="text-zinc-500 text-sm max-w-sm mx-auto mb-10">
                                We are ready to handshake with your Shopify instance. This will finalize your vendor account setup.
                            </p>

                            {error && (
                                <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3 text-red-500 text-xs text-left">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    {error}
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    disabled={loading}
                                    onClick={prevStep}
                                    className="h-14 bg-zinc-900 text-zinc-400 font-bold rounded-xl border border-zinc-800 hover:bg-zinc-800 transition-all disabled:opacity-50"
                                >
                                    RECONFIGURE
                                </button>
                                <button
                                    disabled={loading}
                                    onClick={handleSubmit}
                                    className="h-14 bg-emerald-accent text-black font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-emerald-600 transition-all disabled:opacity-70"
                                >
                                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "FINALIZE SYNC"}
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    )
}
