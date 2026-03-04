"use client"

import { motion } from "framer-motion"
import { LandingNavbar } from "@/components/landing/LandingNavbar"
import { LandingFooter } from "@/components/landing/LandingFooter"
import { Cookie, Shield, Eye } from "lucide-react"

export default function CookiesPage() {
    return (
        <div className="min-h-screen bg-[#0a0e1a]">
            <LandingNavbar isLoggedIn={false} />
            <main className="pt-32 pb-20 container mx-auto px-6 max-w-4xl">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white/5 backdrop-blur-xl rounded-[40px] p-8 md:p-12 border border-white/10"
                >
                    <div className="flex items-center gap-4 mb-8">
                        <div className="w-16 h-16 rounded-2xl bg-indigo-500/20 flex items-center justify-center border border-indigo-500/20">
                            <Cookie className="w-8 h-8 text-indigo-400" />
                        </div>
                        <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter uppercase">Cookie Policy</h1>
                    </div>

                    <div className="prose prose-invert max-w-none space-y-8 text-slate-400 font-medium leading-relaxed">
                        <section>
                            <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-4">1. What are cookies?</h2>
                            <p>
                                Cookies are small text files that are stored on your device when you visit our website. They help us make your experience better by remembering your preferences and how you use the site.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-4">2. How we use cookies</h2>
                            <p>
                                JUNO uses cookies to:
                            </p>
                            <ul className="list-disc pl-6 space-y-2">
                                <li>Keep you signed in during your session.</li>
                                <li>Understand how our platform is being used.</li>
                                <li>Improve security and prevent fraud.</li>
                                <li>Personalize your dashboard experience.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-4">3. Types of cookies we use</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="p-6 rounded-2xl bg-white/5 border border-white/5">
                                    <h3 className="text-white font-black mb-2 uppercase text-sm">Essential Cookies</h3>
                                    <p className="text-sm">Necessary for the website to function. These cannot be switched off.</p>
                                </div>
                                <div className="p-6 rounded-2xl bg-white/5 border border-white/5">
                                    <h3 className="text-white font-black mb-2 uppercase text-sm">Analytical Cookies</h3>
                                    <p className="text-sm">Help us measure performance and improve our services.</p>
                                </div>
                            </div>
                        </section>

                        <p className="pt-8 border-t border-white/5 text-sm italic">
                            Last updated: February 14, 2026. For more information, please contact our support team.
                        </p>
                    </div>
                </motion.div>
            </main>
            <LandingFooter />
        </div>
    )
}
