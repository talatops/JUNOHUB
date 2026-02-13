"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Mail, Lock, Loader2, User, ShoppingBag, Truck, Zap } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"

export default function SignupPage() {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")
    const [role, setRole] = useState<"VENDOR" | "SUPPLIER">("VENDOR")
    const router = useRouter()

    const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setLoading(true)
        setError("")

        const formData = new FormData(e.currentTarget)
        const name = formData.get("name") as string
        const email = formData.get("email") as string
        const password = formData.get("password") as string

        try {
            const res = await fetch("/api/auth/register", {
                method: "POST",
                body: JSON.stringify({ name, email, password, role }),
                headers: { "Content-Type": "application/json" },
            })

            if (res.ok) {
                router.push("/login?message=Account created successfully")
            } else {
                const data = await res.json()
                setError(data.message || "Something went wrong")
            }
        } catch {
            setError("An error occurred. Please try again.")
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
                className="w-full max-w-lg relative z-10"
            >
                <div className="bg-white/5 backdrop-blur-xl rounded-2xl md:rounded-3xl p-6 md:p-8 border border-white/10">
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center gap-3 mb-4">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-500/40 border border-white/20 flex items-center justify-center backdrop-blur-sm">
                                <Zap className="w-6 h-6 text-white fill-white" />
                            </div>
                            <h1 className="text-2xl font-bold tracking-tight text-white">JUNOHUB</h1>
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-2">
                            Create your <span className="text-indigo-400">Account</span>
                        </h2>
                        <p className="text-slate-400 text-sm">
                            Join JUNOHUB and streamline your dropshipping business.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 mb-6 md:mb-8">
                        <button
                            type="button"
                            onClick={() => setRole("VENDOR")}
                            className={`p-4 rounded-2xl border transition-all duration-200 text-left ${role === "VENDOR"
                                ? "border-indigo-500/50 bg-indigo-500/20"
                                : "border-white/10 bg-white/5 hover:bg-white/10"
                                }`}
                        >
                            <div className={`mb-2 w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${role === "VENDOR" ? "bg-indigo-500/50 text-white border border-indigo-400/30" : "bg-white/10 text-slate-400 border border-white/10"}`}>
                                <ShoppingBag className="w-5 h-5" />
                            </div>
                            <div className="font-bold text-sm text-white">Vendor</div>
                            <div className="text-[10px] text-slate-400 font-medium">Sell products and manage your online store</div>
                        </button>

                        <button
                            type="button"
                            onClick={() => setRole("SUPPLIER")}
                            className={`p-4 rounded-2xl border transition-all duration-200 text-left ${role === "SUPPLIER"
                                ? "border-blue-500/50 bg-blue-500/20"
                                : "border-white/10 bg-white/5 hover:bg-white/10"
                                }`}
                        >
                            <div className={`mb-2 w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${role === "SUPPLIER" ? "bg-blue-500/50 text-white border border-blue-400/30" : "bg-white/10 text-slate-400 border border-white/10"}`}>
                                <Truck className="w-5 h-5" />
                            </div>
                            <div className="font-bold text-sm text-white">Supplier</div>
                            <div className="text-[10px] text-slate-400 font-medium">Provide inventory and connect with vendors</div>
                        </button>
                    </div>

                    <form onSubmit={handleSignup} className="space-y-4">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                                    Full Name
                                </label>
                                <div className="relative">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                    <input
                                        name="name"
                                        type="text"
                                        required
                                        placeholder="John Carter"
                                        className="w-full h-12 bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 transition-all duration-200"
                                    />
                                </div>
                            </div>

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
                                        placeholder="john@example.com"
                                        className="w-full h-12 bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 transition-all duration-200"
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
                                        placeholder="••••••••"
                                        className="w-full h-12 bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 transition-all duration-200"
                                    />
                                </div>
                            </div>
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
                                    Create Account
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
                        Already have an account?{" "}
                        <Link href="/login" className="text-indigo-400 hover:underline decoration-indigo-400/50 underline-offset-4 font-bold transition-all">
                            Log in here
                        </Link>
                    </p>
                </div>
            </motion.div>
            <div className="mt-6 flex flex-col items-center gap-1 text-[9px] text-slate-500 font-semibold uppercase tracking-widest">
                <div className="flex items-center gap-4">
                    <Link
                        href="/privacy-policy"
                        className="hover:text-indigo-300 underline-offset-4 hover:underline normal-case"
                    >
                        Privacy Policy
                    </Link>
                    <span className="text-slate-600">•</span>
                    <Link
                        href="/terms-of-service"
                        className="hover:text-indigo-300 underline-offset-4 hover:underline normal-case"
                    >
                        Terms of Service
                    </Link>
                </div>
            </div>
        </div>
    )
}
