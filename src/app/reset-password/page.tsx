"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import { Lock, Loader2, Zap, CheckCircle2 } from "lucide-react"
import Link from "next/link"

function ResetPasswordForm() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [password, setPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")
    const [success, setSuccess] = useState(false)
    const token = searchParams.get("token") ?? ""
    const email = searchParams.get("email") ?? ""

    useEffect(() => {
        if (!token || !email) {
            setError("Invalid or missing reset link. Please request a new password reset.")
        }
    }, [token, email])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError("")
        if (password !== confirmPassword) {
            setError("Passwords do not match.")
            setLoading(false)
            return
        }
        if (password.length < 8) {
            setError("Password must be at least 8 characters.")
            setLoading(false)
            return
        }
        try {
            const res = await fetch("/api/auth/password-reset/reset", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, email, password }),
            })
            const data = await res.json()
            if (res.ok) {
                setSuccess(true)
                setTimeout(() => router.push("/login"), 2000)
            } else {
                setError(data.message || "Failed to reset password. The link may have expired.")
            }
        } catch {
            setError("An error occurred. Please try again.")
        } finally {
            setLoading(false)
        }
    }

    if (success) {
        return (
            <div className="text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-7 h-7 text-emerald-400" />
                </div>
                <p className="text-slate-200 font-medium">Password has been reset successfully. Redirecting to login...</p>
                <Link href="/login" className="inline-block text-indigo-400 hover:underline font-medium text-sm">
                    Go to login now
                </Link>
            </div>
        )
    }

    if (!token || !email) {
        return (
            <div className="text-center space-y-4">
                <p className="text-red-400 font-medium">{error}</p>
                <Link href="/forgot-password" className="inline-block text-indigo-400 hover:underline font-medium text-sm">
                    Request a new reset link
                </Link>
            </div>
        )
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                    New Password
                </label>
                <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                        type="password"
                        required
                        minLength={8}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full h-12 bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 transition-all duration-200"
                    />
                </div>
            </div>
            <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                    Confirm Password
                </label>
                <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                        type="password"
                        required
                        minLength={8}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
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
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Reset password"}
            </button>
        </form>
    )
}

export default function ResetPasswordPage() {
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
                            Reset <span className="text-indigo-400">Password</span>
                        </h2>
                        <p className="text-slate-400 text-sm">
                            Enter your new password below.
                        </p>
                    </div>

                    <Suspense fallback={<div className="text-slate-400 text-center py-4">Loading...</div>}>
                        <ResetPasswordForm />
                    </Suspense>

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
