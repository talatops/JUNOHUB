"use client"

import { signIn } from "next-auth/react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Mail, Lock, Loader2, Zap, Shield } from "lucide-react"
import Link from "next/link"

export default function LoginPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")
    const [requiresMFA, setRequiresMFA] = useState(false)
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [mfaCode, setMfaCode] = useState("")

    const handleCredentialsLogin = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setLoading(true)
        setError("")

        // Get values from form (FormData works even with controlled inputs)
        const formData = new FormData(e.currentTarget)
        const emailFromForm = (formData.get("email") as string)?.trim() || ""
        const passwordFromForm = (formData.get("password") as string) || ""
        const mfaCodeValue = (formData.get("mfaCode") as string)?.trim() || ""

        // Use form values, fallback to state if form is empty (shouldn't happen with controlled inputs)
        const emailValue = emailFromForm || email.trim()
        const passwordValue = passwordFromForm || password

        // Update state to keep it in sync
        if (emailFromForm && emailFromForm !== email) setEmail(emailFromForm)
        if (passwordFromForm && passwordFromForm !== password) setPassword(passwordFromForm)

        // Validate inputs
        if (!emailValue || !passwordValue) {
            setError("Please enter both email and password")
            setLoading(false)
            return
        }

        try {
            // First, check credentials and MFA status
            const loginRes = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: emailValue,
                    password: passwordValue,
                    mfaCode: mfaCodeValue || undefined
                })
            })

            const loginData = await loginRes.json()

            if (!loginRes.ok) {
                setError(loginData.message || "Invalid email or password")
                setRequiresMFA(false)
                return
            }

            // If MFA is required and code not provided, show MFA input
            if (loginData.requiresMFA && !mfaCodeValue) {
                setRequiresMFA(true)
                return
            }

            // If MFA was required and code provided, or MFA not required, proceed with NextAuth signIn
            const res = await signIn("credentials", {
                email: emailValue,
                password: passwordValue,
                redirect: false,
                callbackUrl: "/onboarding",
            })

            if (res?.error) {
                setError("Authentication failed. Please try again.")
                setRequiresMFA(false)
            } else {
                // Redirect based on user role - middleware will handle the final routing
                // For now, just refresh and let middleware redirect appropriately
                router.refresh()
            }
        } catch {
            setError("An error occurred. Please try again.")
            setRequiresMFA(false)
        } finally {
            setLoading(false)
        }
    }

    const handleGoogleSignIn = () => {
        signIn("google", { callbackUrl: "/onboarding" })
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
                    <div className="text-center mb-10">
                        <div className="inline-flex items-center justify-center gap-3 mb-4">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-500/40 border border-white/20 flex items-center justify-center backdrop-blur-sm">
                                <Zap className="w-6 h-6 text-white fill-white" />
                            </div>
                            <h1 className="text-2xl font-bold tracking-tight text-white">JUNOHUB</h1>
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-2">
                            Welcome <span className="text-indigo-400">Back</span>
                        </h2>
                        <p className="text-slate-400 text-sm">
                            Access your dropshipping empire.
                        </p>
                    </div>

                    <form onSubmit={handleCredentialsLogin} className="space-y-4">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                                    Email Address
                                </label>
                                <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                    <input
                                        name="email"
                                        type="email"
                                        required
                                        disabled={requiresMFA}
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="john@example.com"
                                        className="w-full h-12 bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 transition-all duration-200 disabled:opacity-50"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                                    Password
                                </label>
                                <div className="relative">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                    <input
                                        name="password"
                                        type="password"
                                        required
                                        disabled={requiresMFA}
                                        value={password}
                                        onChange={(e) => {
                                            setPassword(e.target.value)
                                        }}
                                        placeholder="••••••••"
                                        className="w-full h-12 bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 transition-all duration-200 disabled:opacity-50"
                                    />
                                </div>
                                <div className="mt-1.5 text-right">
                                    <Link href="/forgot-password" className="text-xs text-indigo-400 hover:text-indigo-300 font-medium">
                                        Forgot password?
                                    </Link>
                                </div>
                            </div>

                            {requiresMFA && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="space-y-2"
                                >
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                                        Verification Code
                                    </label>
                                    <div className="relative">
                                        <Shield className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400" />
                                        <input
                                            name="mfaCode"
                                            type="text"
                                            required={requiresMFA}
                                            value={mfaCode}
                                            onChange={(e) => {
                                                const value = e.target.value.replace(/\D/g, "").slice(0, 6)
                                                setMfaCode(value)
                                            }}
                                            placeholder="000000"
                                            className="w-full h-12 bg-white/5 border border-indigo-500/30 rounded-xl pl-11 pr-4 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 transition-all duration-200 text-center text-2xl font-mono tracking-widest"
                                            maxLength={6}
                                            autoFocus
                                        />
                                    </div>
                                    <p className="text-xs text-slate-400 ml-1">
                                        Enter the 6-digit code from your authenticator app
                                    </p>
                                </motion.div>
                            )}
                        </div>

                        {error && (
                            <p className="text-red-400 text-xs mt-2 ml-1 font-medium bg-red-500/10 p-2 rounded-lg border border-red-500/20">
                                {error}
                            </p>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full h-12 bg-indigo-500 hover:bg-indigo-600 text-white font-bold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 group cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed border border-indigo-400/20"
                        >
                            {loading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    {requiresMFA ? "Verify & Log In" : "Log In"}
                                    <span className="group-hover:translate-x-1 transition-transform duration-200">→</span>
                                </>
                            )}
                        </button>
                    </form>

                    <div className="relative my-8">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-white/10"></div>
                        </div>
                        <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-widest">
                            <span className="bg-transparent px-4 text-slate-500">Or continue with</span>
                        </div>
                    </div>

                    <button
                        onClick={handleGoogleSignIn}
                        type="button"
                        className="w-full h-12 flex items-center justify-center gap-3 bg-white/10 border border-white/10 text-white font-bold rounded-xl hover:bg-white/15 backdrop-blur-sm transition-all duration-200 cursor-pointer"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path fill="#EA4335" d="M5.2662 9.76453C6.19903 6.93863 8.85469 4.90909 12 4.90909C13.6909 4.90909 15.2182 5.50909 16.4182 6.49091L19.9091 3C17.7818 1.14545 15.0545 0 12 0C7.27273 0 3.19091 2.69091 1.24545 6.65455L5.2662 9.76453Z" />
                            <path fill="#4285F4" d="M23.4909 12.2727C23.4909 11.4909 23.4182 10.7455 23.2909 10H12V14.5091H18.4364C18.1455 16.0364 17.2909 17.3091 16 18.2182L19.9091 21.2727C22.1818 19.1818 23.4909 16.0364 23.4909 12.2727Z" />
                            <path fill="#FBBC05" d="M5.26649 14.2355C5.02103 13.4909 4.88182 12.7091 4.88182 11.8909C4.88182 11.0727 5.02103 10.2909 5.26649 9.54545L1.24545 6.43636C0.454545 8.05455 0 9.87273 0 11.8909C0 13.9091 0.454545 15.7273 1.24545 17.3455L5.26649 14.2355Z" />
                            <path fill="#34A853" d="M12 24C15.0545 24 17.7818 22.9091 19.9091 21.0545L16 18C14.8909 18.7273 13.5273 19.1818 12 19.1818C8.85469 19.1818 6.19903 17.1522 5.2662 14.3263L1.24545 17.4364C3.19091 21.3636 7.27273 24 12 24Z" />
                        </svg>
                        Google
                    </button>

                    <p className="text-center mt-8 text-sm text-slate-400 font-medium">
                        Don&apos;t have an account?{" "}
                        <Link href="/signup" className="text-indigo-400 hover:underline decoration-indigo-400/50 underline-offset-4 font-bold transition-all">
                            Create an account
                        </Link>
                    </p>
                </div>

                <div className="mt-8 space-y-2 text-center text-slate-500 text-[10px] uppercase tracking-widest font-bold">
                    <div>
                        JUNOHUB Systems &copy; 2026
                    </div>
                    <div className="flex items-center justify-center gap-4 text-[9px] font-semibold normal-case text-slate-400">
                        <Link
                            href="/privacy-policy"
                            className="hover:text-indigo-300 underline-offset-4 hover:underline"
                        >
                            Privacy Policy
                        </Link>
                        <span className="text-slate-600">•</span>
                        <Link
                            href="/terms-of-service"
                            className="hover:text-indigo-300 underline-offset-4 hover:underline"
                        >
                            Terms of Service
                        </Link>
                    </div>
                </div>
            </motion.div>
        </div>
    )
}
