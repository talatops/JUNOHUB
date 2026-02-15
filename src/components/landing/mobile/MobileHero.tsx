"use client"

import { motion } from "framer-motion"
import { ArrowRight, Play, ShieldCheck, Zap, Globe, MessageSquare } from "lucide-react"
import Link from "next/link"

const stats = [
    { label: "AES-250 READY", icon: ShieldCheck },
    { label: "SHOPIFY SYNC", icon: Zap },
    { label: "120+ COUNTRIES", icon: Globe },
    { label: "E2E CHAT", icon: MessageSquare },
]

export function MobileHero() {
    return (
        <section className="relative min-h-[95vh] flex flex-col items-center justify-between px-6 pb-12 pt-16 overflow-hidden bg-[#0a0e1a]">
            {/* The Pulse Core - Central Visual */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full z-0 pointer-events-none flex items-center justify-center">
                <div className="w-64 h-64 bg-indigo-600/30 blur-[80px] rounded-full animate-pulse will-change-[transform,opacity]" />
                <div className="absolute w-40 h-40 bg-purple-600/20 blur-[60px] rounded-full animate-pulse delay-700" />
                <div className="absolute w-[300px] h-[1px] bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent rotate-45" />
                <div className="absolute w-[300px] h-[1px] bg-gradient-to-r from-transparent via-purple-500/20 to-transparent -rotate-45" />
            </div>

            <div className="relative z-10 text-center flex flex-col items-center w-full mt-12">
                {/* Mobile-First Badge */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md mb-8"
                >
                    <span className="flex h-1.5 w-1.5 rounded-full bg-indigo-500 animate-ping" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">Next-Gen Engine</span>
                </motion.div>

                {/* Big, Punchy Mobile Header */}
                <motion.h1
                    initial={{ opacity: 1, y: 0 }}
                    className="text-6xl font-black tracking-tighter text-white mb-6 leading-[0.85] uppercase italic"
                >
                    THE <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-br from-indigo-400 via-white to-purple-400">PULSE.</span>
                </motion.h1>

                <motion.p
                    initial={{ opacity: 1 }}
                    className="text-slate-300 text-sm font-medium mb-12 max-w-[260px] leading-relaxed mx-auto"
                >
                    Bridge the gap between vendors and suppliers with the world&apos;s most advanced
                    encrypted ecosystem.
                </motion.p>

                {/* Thumb-Zone CTAs */}
                <div className="flex flex-col w-full gap-4 max-w-[300px]">
                    <Link
                        href="/signup"
                        className="w-full py-5 bg-indigo-600 rounded-2xl font-black text-white shadow-xl shadow-indigo-600/20 flex items-center justify-center gap-2 active:scale-95 transition-all text-sm uppercase tracking-wider"
                    >
                        GET STARTED NOW <ArrowRight className="w-4 h-4" />
                    </Link>

                    <button className="w-full py-5 rounded-2xl font-black text-white bg-white/5 border border-white/10 flex items-center justify-center gap-3 active:scale-95 transition-all text-sm uppercase tracking-wider backdrop-blur-sm">
                        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                            <Play className="w-3 h-3 fill-white ml-0.5" />
                        </div>
                        WATCH DEMO
                    </button>
                </div>
            </div>

            {/* Infinite Marquee for Stats - Prevents Overlap */}
            <div className="relative w-full z-10 mt-auto pt-12 overflow-hidden mb-4">
                <div className="absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-[#0a0e1a] to-transparent z-20" />
                <div className="absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-[#0a0e1a] to-transparent z-20" />

                <motion.div
                    animate={{ x: [0, -1000] }}
                    transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
                    className="flex whitespace-nowrap gap-8"
                >
                    {[...stats, ...stats, ...stats, ...stats].map((s, i) => (
                        <div key={i} className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-full border border-white/10">
                            <s.icon className="w-3 h-3 text-indigo-400" />
                            <span className="text-[10px] font-black tracking-[0.1em] text-white uppercase whitespace-nowrap">{s.label}</span>
                        </div>
                    ))}
                </motion.div>
            </div>
        </section>
    )
}
