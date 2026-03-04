"use client"

import { motion } from "framer-motion"
import {
    Zap,
    MessageSquare,
    BarChart3,
    ShieldCheck,
    LayoutDashboard,
    RefreshCcw,
    ArrowRight
} from "lucide-react"
import Link from "next/link"

const features = [
    {
        title: "Shopify Sync",
        icon: RefreshCcw,
        color: "text-emerald-400",
        bg: "bg-emerald-500/10",
        size: "col-span-1"
    },
    {
        title: "E2E Chat",
        icon: MessageSquare,
        color: "text-blue-400",
        bg: "bg-blue-500/10",
        size: "col-span-1"
    },
    {
        title: "High Octane Analytics",
        icon: BarChart3,
        color: "text-purple-400",
        bg: "bg-purple-500/10",
        size: "col-span-2"
    },
    {
        title: "Dashboard",
        icon: LayoutDashboard,
        color: "text-orange-400",
        bg: "bg-orange-500/10",
        size: "col-span-1"
    },
    {
        title: "Security",
        icon: ShieldCheck,
        color: "text-red-400",
        bg: "bg-red-500/10",
        size: "col-span-1"
    },
    {
        title: "Global Scalability",
        icon: Zap,
        color: "text-yellow-400",
        bg: "bg-yellow-500/10",
        size: "col-span-2"
    }
]

export function MobileFeatures() {
    return (
        <section className="py-24 px-6 bg-[#0a0e1a] relative overflow-hidden">
            {/* Decorative lines */}
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />

            <div className="mb-16 text-center">
                <motion.div
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em] mb-4"
                >
                    Infrastructure
                </motion.div>
                <h2 className="text-4xl font-black text-white mb-6 tracking-tighter uppercase italic">Dominance.</h2>
                <div className="w-12 h-1 bg-indigo-600 mx-auto rounded-full" />
            </div>

            <div className="grid grid-cols-2 gap-4">
                {features.map((f, i) => (
                    <motion.div
                        key={f.title}
                        initial={{ opacity: 1, scale: 0.95 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.05 }}
                        className={`${f.size} p-8 rounded-[2rem] border border-white/5 bg-white/[0.02] flex flex-col items-center justify-center text-center relative overflow-hidden group active:bg-white/5 transition-colors`}
                    >
                        {/* Glow */}
                        <div className={`absolute -top-4 -right-4 w-16 h-16 ${f.bg} blur-[30px] opacity-20`} />

                        <div className={`w-14 h-14 rounded-[1.25rem] ${f.bg} flex items-center justify-center mb-4 border border-white/5 shadow-inner`}>
                            <f.icon className={`w-7 h-7 ${f.color}`} />
                        </div>
                        <h3 className="text-xs font-black text-white uppercase tracking-widest">{f.title}</h3>
                    </motion.div>
                ))}
            </div>

            <div className="mt-20 p-8 rounded-[2.5rem] bg-gradient-to-br from-indigo-600 to-purple-600 text-center relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 blur-[40px] rounded-full" />
                <h3 className="text-2xl font-black text-white mb-4 uppercase italic">Ready to sync?</h3>
                <p className="text-indigo-100 text-sm font-medium mb-8 opacity-90">Join the thousands of vendors scaling with JUNO.</p>
                <Link href="/signup" className="inline-flex items-center gap-2 px-8 py-4 bg-white text-indigo-600 rounded-2xl font-black text-sm uppercase tracking-wider shadow-lg">
                    Get Started <ArrowRight className="w-4 h-4" />
                </Link>
            </div>
        </section>
    )
}
