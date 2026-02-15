"use client"

import { useRef } from "react"
import { motion, useScroll, useTransform } from "framer-motion"
import { ShieldCheck, Zap, Globe, ArrowRight, Play } from "lucide-react"
import Link from "next/link"

export function LandingHero() {
    const containerRef = useRef<HTMLDivElement>(null)
    const { scrollYProgress } = useScroll({
        target: containerRef,
        offset: ["start start", "end start"],
    })

    const y1 = useTransform(scrollYProgress, [0, 1], [0, 200])
    const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0])
    const scale = useTransform(scrollYProgress, [0, 0.5], [1, 0.9])

    return (
        <section
            ref={containerRef}
            className="relative min-h-screen flex items-center justify-center pt-20 overflow-hidden"
        >
            {/* Background Decorative Elements */}
            <div className="absolute inset-0 z-0 pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/20 blur-[120px] rounded-full animate-pulse will-change-[transform,opacity]" />
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/20 blur-[120px] rounded-full animate-pulse delay-700 will-change-[transform,opacity]" />
            </div>

            {/* Grid Pattern */}
            <div className="absolute inset-0 z-0 opacity-[0.03] bg-[url('/noise.svg')] pointer-events-none" />
            <div
                className="absolute inset-0 z-0 opacity-[0.4]"
                style={{
                    backgroundImage: `radial-gradient(circle at 2px 2px, rgba(255,255,255,0.05) 1px, transparent 0)`,
                    backgroundSize: '40px 40px'
                }}
            />

            <motion.div
                style={{ y: y1, opacity, scale }}
                className="container mx-auto px-6 relative z-10 text-center"
            >
                {/* Badge */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md mb-8"
                >
                    <span className="flex h-2 w-2 rounded-full bg-indigo-500 animate-ping" />
                    <span className="text-xs font-black uppercase tracking-[0.2em] text-indigo-400">Next-Gen Supply Chain</span>
                </motion.div>

                {/* Main Heading */}
                <motion.h1
                    initial={{ opacity: 1, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                    className="text-5xl md:text-8xl font-black tracking-tighter text-white mb-8 leading-[0.9]"
                >
                    THE PULSE OF <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-indigo-400 animate-gradient-x">GLOBAL COMMERCE.</span>
                </motion.h1>

                {/* Subtext */}
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 1, delay: 0.2 }}
                    className="max-w-2xl mx-auto text-lg md:text-xl text-slate-300 font-medium mb-12 leading-relaxed"
                >
                    Bridge the gap between vendors and suppliers with the world&apos;s most advanced
                    encrypted ecosystem. Sync Shopify, chat securely, and scale effortlessly.
                </motion.p>

                {/* CTAs */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.6 }}
                    className="flex flex-col sm:flex-row items-center justify-center gap-6"
                >
                    <Link
                        href="/signup"
                        className="group relative px-10 py-5 bg-indigo-600 rounded-2xl font-black text-white overflow-hidden shadow-2xl shadow-indigo-600/20 active:scale-95 transition-all"
                    >
                        <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                        <span className="relative flex items-center gap-2">
                            GET STARTED NOW <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </span>
                    </Link>

                    <button className="flex items-center gap-3 px-8 py-5 rounded-2xl font-black text-white hover:bg-white/5 transition-all border border-transparent hover:border-white/10 group">
                        <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Play className="w-4 h-4 fill-white ml-0.5" />
                        </div>
                        WATCH DEMO
                    </button>
                </motion.div>

                {/* Trust Logos Placeholder / Stats */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 1, delay: 1 }}
                    className="mt-24 pt-12 border-t border-white/5 grid grid-cols-2 md:grid-cols-4 gap-8 opacity-40 hover:opacity-60 transition-opacity"
                >
                    <div className="flex items-center justify-center gap-2 font-black tracking-widest text-sm">
                        <ShieldCheck className="w-5 h-5 text-indigo-400" /> AES-250 READY
                    </div>
                    <div className="flex items-center justify-center gap-2 font-black tracking-widest text-sm">
                        <Zap className="w-5 h-5 text-indigo-400" /> SHOPIFY SYNC
                    </div>
                    <div className="flex items-center justify-center gap-2 font-black tracking-widest text-sm">
                        <Globe className="w-5 h-5 text-indigo-400" /> 120+ COUNTRIES
                    </div>
                    <div className="flex items-center justify-center gap-2 font-black tracking-widest text-sm">
                        <ShieldCheck className="w-5 h-5 text-indigo-400" /> E2E CHAT
                    </div>
                </motion.div>
            </motion.div>

            {/* Scroll Indicator */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.5, duration: 1 }}
                className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
            >
                <div className="w-[1px] h-12 bg-gradient-to-b from-transparent via-indigo-500/50 to-transparent relative overflow-hidden">
                    <motion.div
                        animate={{ y: [0, 48] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                        className="absolute top-0 left-0 w-full h-1/3 bg-indigo-500"
                    />
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Scroll</span>
            </motion.div>
        </section>
    )
}
