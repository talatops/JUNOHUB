"use client"

import { motion } from "framer-motion"
import { LandingNavbar } from "@/components/landing/LandingNavbar"
import { LandingFooter } from "@/components/landing/LandingFooter"
import {
    Zap,
    Shield,
    RefreshCcw,
    BarChart3,
    Globe,
    Layers,
    Cpu,
    Network
} from "lucide-react"

const architectureItems = [
    {
        title: "Real-time Sync Engine",
        description: "Our proprietary sync engine ensures that inventory and product data are updated across your entire network in milliseconds.",
        icon: RefreshCcw,
        color: "text-blue-400"
    },
    {
        title: "E2E Encryption",
        description: "All communications and trade data are protected with AES-256 end-to-end encryption, ensuring your business secrets stay secret.",
        icon: Shield,
        color: "text-emerald-400"
    },
    {
        title: "Global Infrastructure",
        description: "Built on a global edge network to provide low-latency access to your dashboard from anywhere in the world.",
        icon: Globe,
        color: "text-purple-400"
    },
    {
        title: "Scalable Core",
        description: "Whether you have 10 or 10,000 vendors, our architecture scales horizontally to meet your demands without performance loss.",
        icon: Layers,
        color: "text-orange-400"
    }
]

export default function PlatformPage() {
    return (
        <div className="min-h-screen bg-[#0a0e1a]">
            <LandingNavbar isLoggedIn={false} />

            <main className="pt-32 pb-20">
                {/* Hero section for Platform */}
                <section className="container mx-auto px-6 mb-24 text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 mb-8"
                    >
                        <Cpu className="w-4 h-4 text-indigo-400" />
                        <span className="text-xs font-black uppercase tracking-[0.2em] text-indigo-400">The Technology</span>
                    </motion.div>

                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="text-5xl md:text-7xl font-black text-white tracking-tighter mb-8 uppercase"
                    >
                        Built for the <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Next Century.</span>
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="max-w-2xl mx-auto text-xl text-slate-400 font-medium"
                    >
                        JUNO isn&apos;t just an app—it&apos;s a high-performance infrastructure designed to power
                        the world&apos;s most ambitious supply chains.
                    </motion.p>
                </section>

                {/* Architecture Grid */}
                <section className="container mx-auto px-6 mb-32">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {architectureItems.map((item, index) => (
                            <motion.div
                                key={item.title}
                                initial={{ opacity: 0, scale: 0.95 }}
                                whileInView={{ opacity: 1, scale: 1 }}
                                viewport={{ once: true }}
                                transition={{ delay: index * 0.1 }}
                                className="p-10 rounded-[40px] bg-white/[0.03] border border-white/10 backdrop-blur-sm group hover:bg-white/[0.05] transition-all"
                            >
                                <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                    <item.icon className={`w-7 h-7 ${item.color}`} />
                                </div>
                                <h3 className="text-2xl font-black text-white mb-4 uppercase tracking-tight">{item.title}</h3>
                                <p className="text-slate-400 font-medium leading-relaxed leading-relaxed">{item.description}</p>
                            </motion.div>
                        ))}
                    </div>
                </section>

                {/* Deep Tech Section */}
                <section className="bg-indigo-600/5 py-24 border-y border-white/5">
                    <div className="container mx-auto px-6 text-center">
                        <Network className="w-16 h-16 text-indigo-400 mx-auto mb-8" />
                        <h2 className="text-4xl font-black text-white mb-8 tracking-tighter uppercase">Fully Distributed Network</h2>
                        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12 text-slate-400 font-bold uppercase tracking-widest text-sm">
                            <div className="space-y-4">
                                <div className="text-5xl font-black text-indigo-400">99.9%</div>
                                <div>Uptime SLA</div>
                            </div>
                            <div className="space-y-4">
                                <div className="text-5xl font-black text-indigo-400">&lt;50ms</div>
                                <div>Global Latency</div>
                            </div>
                            <div className="space-y-4">
                                <div className="text-5xl font-black text-indigo-400">AES-256</div>
                                <div>Security Standard</div>
                            </div>
                        </div>
                    </div>
                </section>
            </main>

            <LandingFooter />
        </div>
    )
}
