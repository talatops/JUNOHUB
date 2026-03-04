"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import { Loader2, Zap, CheckCircle2, XCircle } from "lucide-react"
import Link from "next/link"

function VerifyEmailContent() {
    const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
    const [message, setMessage] = useState("")
    const searchParams = useSearchParams()
    const token = searchParams.get("token") ?? ""
    const email = searchParams.get("email") ?? ""

    useEffect(() => {
        if (!token || !email) {
            setStatus("error")
            setMessage("Invalid or missing verification link.")
            return
        }
        setStatus("loading")
        fetch("/api/auth/verify-email/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token, email }),
        })
            .then((res) => res.json())
            .then((data) => {
                if (data.message === "Email verified successfully") {
                    setStatus("success")
                } else {
                    setStatus("error")
                    setMessage(data.message || "Verification failed.")
                }
            })
            .catch(() => {
                setStatus("error")
                setMessage("An error occurred. Please try again.")
            })
    }, [token, email])

    if (status === "loading" || status === "idle") {
        return (
            <div className="text-center py-8">
                <Loader2 className="w-10 h-10 animate-spin text-indigo-400 mx-auto mb-4" />
                <p className="text-slate-400 font-medium">Verifying your email...</p>
            </div>
        )
    }

    if (status === "success") {
        return (
            <div className="text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-7 h-7 text-emerald-400" />
                </div>
                <h3 className="text-xl font-bold text-white">Email verified</h3>
                <p className="text-slate-400 text-sm">Your email has been verified successfully. You can now sign in.</p>
                <Link
                    href="/login"
                    className="inline-flex items-center justify-center h-12 px-6 bg-indigo-500 hover:bg-indigo-600 text-white font-bold rounded-xl transition-all"
                >
                    Go to login
                </Link>
            </div>
        )
    }

    return (
        <div className="text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-red-500/20 border border-red-500/30 flex items-center justify-center mx-auto">
                <XCircle className="w-7 h-7 text-red-400" />
            </div>
            <h3 className="text-xl font-bold text-white">Verification failed</h3>
            <p className="text-slate-400 text-sm">{message}</p>
            <Link href="/login" className="inline-block text-indigo-400 hover:underline font-medium text-sm">
                Back to login
            </Link>
        </div>
    )
}

export default function VerifyEmailPage() {
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
                            Verify <span className="text-indigo-400">Email</span>
                        </h2>
                    </div>

                    <Suspense fallback={<div className="text-slate-400 text-center py-4">Loading...</div>}>
                        <VerifyEmailContent />
                    </Suspense>
                </div>
            </motion.div>
        </div>
    )
}
