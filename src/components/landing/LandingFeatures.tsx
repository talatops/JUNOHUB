"use client"

import { motion } from "framer-motion"
import {
    Zap,
    MessageSquare,
    BarChart3,
    ShieldCheck,
    LayoutDashboard,
    RefreshCcw
} from "lucide-react"

const features = [
    {
        title: "Dynamic Shopify Sync",
        description: "Real-time product and inventory synchronization across your entire vendor network.",
        icon: RefreshCcw,
        color: "text-emerald-400",
        bg: "bg-emerald-500/10",
        border: "border-emerald-500/20"
    },
    {
        title: "Encrypted E2E Chat",
        description: "Secure, real-time communication between vendors and suppliers with full encryption.",
        icon: MessageSquare,
        color: "text-blue-400",
        bg: "bg-blue-500/10",
        border: "border-blue-500/20"
    },
    {
        title: "Advanced Analytics",
        description: "Deep insights into sales performance, order trends, and connection efficiency.",
        icon: BarChart3,
        color: "text-purple-400",
        bg: "bg-purple-500/10",
        border: "border-purple-500/20"
    },
    {
        title: "Premium Dashboard",
        description: "A state-of-the-art glassmorphic interface designed for clarity and speed.",
        icon: LayoutDashboard,
        color: "text-orange-400",
        bg: "bg-orange-500/10",
        border: "border-orange-500/20"
    },
    {
        title: "Military-Grade Security",
        description: "Multi-layer protection for all your trade data and sensitive business relationships.",
        icon: ShieldCheck,
        color: "text-red-400",
        bg: "bg-red-500/10",
        border: "border-red-500/20"
    },
    {
        title: "Instant Scaling",
        description: "Add vendors or suppliers in seconds and watch your business ecosystem grow.",
        icon: Zap,
        color: "text-yellow-400",
        bg: "bg-yellow-500/10",
        border: "border-yellow-500/20"
    }
]

export function LandingFeatures() {
    return (
        <section id="features" className="py-24 relative overflow-hidden">
            <div className="container mx-auto px-6">
                <div className="text-center mb-20">
                    <motion.h2
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="text-4xl md:text-5xl font-black tracking-tighter text-white mb-6"
                    >
                        EVERYTHING YOU NEED TO <br />
                        <span className="text-indigo-400">DOMINATE THE MARKET.</span>
                    </motion.h2>
                    <motion.p
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.2 }}
                        className="text-slate-400 max-w-2xl mx-auto font-medium"
                    >
                        We built JUNO to be the ultimate operating system for modern commerce.
                        Fast, secure, and beautiful.
                    </motion.p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {features.map((feature, index) => (
                        <motion.div
                            key={feature.title}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: index * 0.1 }}
                            whileHover={{ y: -5, transition: { duration: 0.2 } }}
                            className={`p-8 rounded-3xl border border-white/5 bg-white/[0.02] backdrop-blur-sm group hover:bg-white/[0.04] transition-all duration-300 relative overflow-hidden`}
                        >
                            {/* Accent Glow */}
                            <div className={`absolute top-0 right-0 w-32 h-32 ${feature.bg} blur-[60px] opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />

                            <div className={`w-14 h-14 rounded-2xl ${feature.bg} flex items-center justify-center mb-6 border ${feature.border} group-hover:scale-110 transition-transform duration-500`}>
                                <feature.icon className={`w-7 h-7 ${feature.color}`} />
                            </div>

                            <h3 className="text-xl font-black text-white mb-4 tracking-tight uppercase">
                                {feature.title}
                            </h3>
                            <p className="text-slate-400 font-medium leading-relaxed">
                                {feature.description}
                            </p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    )
}
