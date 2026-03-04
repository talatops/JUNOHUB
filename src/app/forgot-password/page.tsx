"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Mail, Loader2, Zap, ArrowLeft } from "lucide-react"
import Link from "next/link"

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")
    const [success, setSuccess] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError("")
        setSuccess(false)
        const trimmed = email.trim()
        if (!trimmed) {
            setError("Please enter your email address.")
            setLoading(false)
            return
        }
        try {
            const res = await fetch("/api/auth/password-reset/request", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: trimmed }),
            })
            const data = await res.json()
            if (res.ok) {
                setSuccess(true)
            } else {
                setError(data.message || "Something went wrong. Please try again.")
            }
        } catch {
            setError("An error occurred. Please try again.")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4 md:p-6 relative overflow-hidden auth-glass-dark">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="w-full max-w-md relative z-10"
            >
                <div className="bg-white/5 backdrop-blur-xl rounded-2xl md:rounded-3xl p-6 md:p-8 border border-white/10">
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center gap-3 mb-4">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-500/40 border border-white/20 flex items-center justify-center backdrop-blur-sm">
                                <Zap className="w-6 h-6 text-white fill-white" />
                            </div>
                            <h1 className="text-2xl font-bold tracking-tight text-white">JUNO</h1>
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-2">
                            Forgot <span className="text-indigo-400">Password</span>
                        </h2>
                        <p className="text-slate-400 text-sm">
                            Enter your email and we&apos;ll send you a link to reset your password.
                        </p>
                    </div>

                    {success ? (
                        <div className="space-y-4 text-center">
                            <p className="text-slate-200 font-medium">
                                If an account with that email exists, a password reset link has been sent. Check your inbox and spam folder.
                            </p>
                            <Link
                                href="/login"
                                className="inline-flex items-center gap-2 text-indigo-400 hover:text-indigo-300 font-bold text-sm"
                            >
                                <ArrowLeft className="w-4 h-4" /> Back to login
                            </Link>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                                    Email Address
                                </label>
                                <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="john@example.com"
                                        className="w-full h-12 bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 transition-all duration-200"
                                    />
                                </div>
                            </div>
                            {error && (
                                <p className="text-red-400 text-xs font-medium bg-red-500/10 p-2 rounded-lg border border-red-500/20">
                                    {error}
                                </p>
                            )}
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full h-12 bg-indigo-500 hover:bg-indigo-600 text-white font-bold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed border border-indigo-400/20"
                            >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Send reset link"}
                            </button>
                        </form>
                    )}

                    <p className="text-center mt-6 text-sm text-slate-400">
                        <Link href="/login" className="text-indigo-400 hover:underline font-medium">
                            Back to login
                        </Link>
                    </p>
                </div>
            </motion.div>
        </div>
    )
}
