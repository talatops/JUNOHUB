"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
    Building2,
    ShoppingBag,
    Settings2,
    CheckCircle2,
    Clock3,
    ArrowRight,
    ArrowLeft,
    Loader2,
    AlertCircle,
    Zap,
    Layout,
    User
} from "lucide-react"
import { useRouter } from "next/navigation"
import Image from "next/image"

const steps = [
    { id: 1, title: "Business Info", icon: Building2 },
    { id: 2, title: "Connect Shopify", icon: ShoppingBag },
    { id: 3, title: "Preferences", icon: Settings2 },
    { id: 4, title: "Finalize", icon: CheckCircle2 },
]

export default function OnboardingClient() {
    const [currentStep, setCurrentStep] = useState(1)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")
    const router = useRouter()

    const [formData, setFormData] = useState({
        businessName: "",
        businessEmail: "",
        country: "",
        timezone: "",
        storeName: "",
        domain: "",
        apiKey: "",
        apiSecret: "",
        accessToken: "",
        syncFrequency: "daily",
        autoFulfill: false,
    })

    const updateFormData = (fields: Partial<typeof formData>) => {
        setFormData(prev => ({ ...prev, ...fields }))
    }

    const handleNext = () => {
        if (currentStep < 4) setCurrentStep(prev => prev + 1)
    }

    const handleBack = () => {
        if (currentStep > 1) setCurrentStep(prev => prev - 1)
    }

    const validateShopify = async () => {
        if (!formData.domain || !formData.accessToken) {
            setError("Domain and Access Token are required.")
            return
        }

        setLoading(true)
        setError("")
        try {
            const res = await fetch("/api/shopify/validate", {
                method: "POST",
                body: JSON.stringify({
                    storeName: formData.storeName,
                    domain: formData.domain,
                    apiKey: formData.apiKey,
                    apiSecret: formData.apiSecret,
                    accessToken: formData.accessToken
                }),
                headers: { "Content-Type": "application/json" }
            })

            if (res.ok) {
                handleNext()
            } else {
                const data = await res.json()
                setError(data.message || "Failed to validate Shopify credentials.")
            }
        } catch {
            setError("An error occurred during validation. Please try again.")
        } finally {
            setLoading(false)
        }
    }

    const completeOnboarding = async () => {
        setLoading(true)
        setError("")
        try {
            const res = await fetch("/api/onboarding/complete", {
                method: "POST",
                body: JSON.stringify(formData),
                headers: { "Content-Type": "application/json" }
            })

            if (res.ok) {
                handleNext()
            } else {
                const data = await res.json()
                setError(data.message || "Failed to save onboarding data.")
            }
        } catch {
            setError("An error occurred. Please try again.")
        } finally {
            setLoading(false)
        }
    }

    const renderStep = () => {
        switch (currentStep) {
            case 1:
                return (
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="space-y-6"
                    >
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Business Name</label>
                                <input
                                    type="text"
                                    value={formData.businessName}
                                    onChange={e => updateFormData({ businessName: e.target.value })}
                                    placeholder="Acme Global"
                                    className="w-full h-12 bg-white/5 border border-white/10 rounded-xl px-4 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 outline-none transition-all"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Business Email</label>
                                <input
                                    type="email"
                                    value={formData.businessEmail}
                                    onChange={e => updateFormData({ businessEmail: e.target.value })}
                                    placeholder="contact@acme.com"
                                    className="w-full h-12 bg-white/5 border border-white/10 rounded-xl px-4 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 outline-none transition-all"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Country</label>
                                <select
                                    value={formData.country}
                                    onChange={e => updateFormData({ country: e.target.value })}
                                    className="w-full h-12 bg-white/5 border border-white/10 rounded-xl px-4 text-white focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 outline-none transition-all"
                                >
                                    <option value="">Select Country</option>
                                    <option value="US">United States</option>
                                    <option value="PK">Pakistan</option>
                                    <option value="UK">United Kingdom</option>
                                    <option value="CA">Canada</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Timezone</label>
                                <select
                                    value={formData.timezone}
                                    onChange={e => updateFormData({ timezone: e.target.value })}
                                    className="w-full h-12 bg-white/5 border border-white/10 rounded-xl px-4 text-white focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 outline-none transition-all"
                                >
                                    <option value="">Select Timezone</option>
                                    <option value="UTC">UTC (Greenwich Mean Time)</option>
                                    <option value="EST">EST (Eastern Standard Time)</option>
                                    <option value="PKT">PKT (Pakistan Standard Time)</option>
                                </select>
                            </div>
                        </div>
                    </motion.div>
                )
            case 2:
                return (
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="space-y-6"
                    >
                        <div className="bg-indigo-500/10 border border-indigo-400/20 p-4 rounded-2xl flex gap-4">
                            <AlertCircle className="w-6 h-6 text-indigo-400 shrink-0" />
                            <div className="text-sm text-slate-300 leading-relaxed">
                                <p className="font-bold mb-1 text-white">How to get your credentials?</p>
                                Go to your Shopify Admin &gt; Settings &gt; Apps and sales channels &gt; Develop apps. Create an app and configure Admin API scopes. For the storefront chat widget auto-injection, enable <span className="font-bold text-white">read_themes</span> and <span className="font-bold text-white">write_themes</span> too.
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Store Name</label>
                                <input
                                    type="text"
                                    value={formData.storeName}
                                    onChange={e => updateFormData({ storeName: e.target.value })}
                                    placeholder="My Store"
                                    className="w-full h-12 bg-white/5 border border-white/10 rounded-xl px-4 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 outline-none transition-all"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Store Domain</label>
                                <input
                                    type="text"
                                    value={formData.domain}
                                    onChange={e => updateFormData({ domain: e.target.value })}
                                    placeholder="mystore.myshopify.com"
                                    className="w-full h-12 bg-white/5 border border-white/10 rounded-xl px-4 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 outline-none transition-all"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">API Key</label>
                                <input
                                    type="password"
                                    value={formData.apiKey}
                                    onChange={e => updateFormData({ apiKey: e.target.value })}
                                    placeholder="••••••••••••"
                                    className="w-full h-12 bg-white/5 border border-white/10 rounded-xl px-4 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 outline-none transition-all"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">API Secret</label>
                                <input
                                    type="password"
                                    value={formData.apiSecret}
                                    onChange={e => updateFormData({ apiSecret: e.target.value })}
                                    placeholder="••••••••••••"
                                    className="w-full h-12 bg-white/5 border border-white/10 rounded-xl px-4 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 outline-none transition-all"
                                />
                            </div>
                            <div className="md:col-span-2 space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Admin Access Token</label>
                                <input
                                    type="password"
                                    value={formData.accessToken}
                                    onChange={e => updateFormData({ accessToken: e.target.value })}
                                    placeholder="shpat_••••••••••••"
                                    className="w-full h-12 bg-white/5 border border-white/10 rounded-xl px-4 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 outline-none transition-all"
                                />
                            </div>
                        </div>
                        {error && <p className="text-red-400 text-xs font-bold bg-red-500/10 p-2 rounded-lg border border-red-500/20">{error}</p>}
                    </motion.div>
                )
            case 3:
                return (
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="space-y-8"
                    >
                        <div className="space-y-6">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between p-4 sm:p-6 bg-white/5 rounded-2xl border border-white/10 group hover:border-indigo-500/30 transition-all">
                                <div className="flex gap-4 items-center">
                                    <div className="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400 border border-indigo-400/20 transition-all">
                                        <Clock3 className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-white">Sync Frequency</p>
                                        <p className="text-xs text-slate-400">How often should we pull shopify data?</p>
                                    </div>
                                </div>
                                <select
                                    value={formData.syncFrequency}
                                    onChange={e => updateFormData({ syncFrequency: e.target.value })}
                                    className="h-10 px-4 bg-white/5 border border-white/10 rounded-lg outline-none font-bold text-sm text-white focus:ring-2 focus:ring-indigo-500/30"
                                >
                                    <option value="realtime">Real-time</option>
                                    <option value="hourly">Hourly</option>
                                    <option value="daily">Daily</option>
                                </select>
                            </div>

                            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between p-4 sm:p-6 bg-white/5 rounded-2xl border border-white/10 group hover:border-emerald-500/30 transition-all">
                                <div className="flex gap-4 items-center">
                                    <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 border border-emerald-400/20 transition-all">
                                        <Zap className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-white">Automated Fulfillment</p>
                                        <p className="text-xs text-slate-400">Automatically push new orders to suppliers?</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => updateFormData({ autoFulfill: !formData.autoFulfill })}
                                    className={`w-14 h-8 rounded-full relative transition-colors ${formData.autoFulfill ? "bg-emerald-500" : "bg-white/20"}`}
                                >
                                    <motion.div
                                        animate={{ x: formData.autoFulfill ? 26 : 4 }}
                                        className="absolute top-1 w-6 h-6 bg-white rounded-full shadow-sm"
                                    />
                                </button>
                            </div>
                        </div>
                        {error && <p className="text-red-400 text-xs font-bold bg-red-500/10 p-2 rounded-lg border border-red-500/20">{error}</p>}
                    </motion.div>
                )
            case 4:
                return (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-center py-12 space-y-6"
                    >
                        <div className="w-20 h-20 bg-indigo-500/20 border border-indigo-400/30 rounded-full flex items-center justify-center mx-auto text-indigo-400">
                            <CheckCircle2 className="w-10 h-10" />
                        </div>
                        <div className="space-y-2">
                            <h2 className="text-2xl font-extrabold text-white tracking-tight">Setup Complete!</h2>
                            <p className="text-slate-400 max-w-sm mx-auto">Your store is now connected. We&apos;ll start syncing your products and orders right away.</p>
                        </div>
                    </motion.div>
                )
        }
    }

    return (
        <div className="min-h-screen flex flex-col auth-glass-dark">
            <nav className="h-16 md:h-20 bg-slate-900/50 border-b border-white/10 flex items-center px-4 md:px-10 justify-between shrink-0 backdrop-blur-xl">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-indigo-500/10 border border-white/10 flex items-center justify-center backdrop-blur-sm overflow-hidden shadow-sm">
                        <Image
                            src="/logo.png"
                            alt="JUNO Logo"
                            width={48}
                            height={48}
                            className="object-cover"
                        />
                    </div>
                    <span className="font-bold text-white tracking-tight text-lg md:text-xl">JUNO</span>
                </div>
                <div className="flex items-center gap-3 md:gap-6">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center">
                            <User className="w-3.5 h-3.5 md:w-4 md:h-4 text-slate-300" />
                        </div>
                        <span className="text-xs md:text-sm font-bold text-slate-300 hidden sm:inline">Account Onboarding</span>
                    </div>
                </div>
            </nav>

            <main className="flex-1 flex flex-col items-center justify-center p-4 md:p-8">
                <div className="w-full max-w-3xl">
                    {/* Progress Bar */}
                    <div className="flex justify-between mb-6 md:mb-12 relative px-2 md:px-4 text-center">
                        {steps.map((step) => (
                            <div key={step.id} className="relative z-10 flex flex-col items-center gap-2 md:gap-3">
                                <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center transition-all duration-300 border ${currentStep >= step.id
                                    ? "bg-indigo-500/50 border-indigo-400/30 text-white"
                                    : "bg-white/5 border-white/10 text-slate-500"
                                    }`}>
                                    <step.icon className="w-4 h-4 md:w-5 md:h-5" />
                                </div>
                                <p className={`text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-center ${currentStep >= step.id ? "text-indigo-400" : "text-slate-500"}`}>{step.title}</p>
                            </div>
                        ))}
                        <div className="absolute top-5 md:top-6 left-1/2 -translate-x-1/2 w-[75%] md:w-[80%] h-0.5 bg-white/10 z-0 rounded-full overflow-hidden">
                            <motion.div
                                animate={{ width: `${((currentStep - 1) / 3) * 100}%` }}
                                className="h-full bg-indigo-500"
                            />
                        </div>
                    </div>

                    <div className="bg-white/5 backdrop-blur-xl rounded-xl md:rounded-2xl p-6 md:p-10 border border-white/10">
                        <AnimatePresence mode="wait">
                            {renderStep()}
                        </AnimatePresence>

                        <div className="mt-6 md:mt-12 flex flex-col sm:flex-row justify-between items-center gap-4 pt-6 md:pt-8 border-t border-white/10">
                            <button
                                onClick={handleBack}
                                disabled={currentStep === 1 || currentStep === 4 || loading}
                                className="flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-indigo-400 transition-colors disabled:opacity-0"
                            >
                                <ArrowLeft className="w-4 h-4" /> Go Back
                            </button>

                            <div className="flex gap-4">
                                {currentStep === 2 ? (
                                    <button
                                        onClick={validateShopify}
                                        disabled={loading}
                                        className="h-12 px-8 bg-indigo-500 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-600 border border-indigo-400/20 transition-all disabled:opacity-70"
                                    >
                                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Validate & Continue"}
                                        {!loading && <ArrowRight className="w-4 h-4" />}
                                    </button>
                                ) : currentStep === 3 ? (
                                    <button
                                        onClick={completeOnboarding}
                                        disabled={loading}
                                        className="h-12 px-8 bg-indigo-500 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-600 border border-indigo-400/20 transition-all disabled:opacity-70"
                                    >
                                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Complete Setup"}
                                        {!loading && <ArrowRight className="w-4 h-4" />}
                                    </button>
                                ) : currentStep === 4 ? (
                                    <button
                                        onClick={() => router.push("/dashboard")}
                                        className="h-12 px-10 bg-indigo-500 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-600 border border-indigo-400/20 transition-all"
                                    >
                                        Go to Dashboard <ArrowRight className="w-4 h-4" />
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleNext}
                                        className="h-12 px-8 bg-white/10 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-white/15 border border-white/10 transition-all"
                                    >
                                        Continue <ArrowRight className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    )
}
