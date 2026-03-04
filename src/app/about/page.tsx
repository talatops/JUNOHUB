"use client"

import { useRef } from "react"
import { motion, useScroll, useTransform, useInView } from "framer-motion"
import { LandingNavbar } from "@/components/landing/LandingNavbar"
import { LandingFooter } from "@/components/landing/LandingFooter"
import { Users, Globe, Rocket, Heart, Zap, Target, Shield, Sparkles } from "lucide-react"

const values = [
    {
        title: "Radical Transparency",
        description: "We believe in a world where every transaction and data point is clear and accessible to those who need it.",
        icon: Target,
        color: "from-blue-500 to-indigo-500"
    },
    {
        title: "Built for Speed",
        description: "In global commerce, every second counts. Our platform is engineered for sub-50ms latency.",
        icon: Zap,
        color: "from-amber-400 to-orange-500"
    },
    {
        title: "Security First",
        description: "Your business secrets are protected by E2E encryption and military-grade security protocols.",
        icon: Shield,
        color: "from-emerald-400 to-teal-500"
    },
    {
        title: "Constant Innovation",
        description: "We don't just follow trends—we set them by redefining what's possible in supply chain tech.",
        icon: Sparkles,
        color: "from-purple-500 to-pink-500"
    }
]

export default function AboutPage() {
    const containerRef = useRef(null)
    const { scrollYProgress } = useScroll({
        target: containerRef,
        offset: ["start start", "end end"]
    })

    const titleY = useTransform(scrollYProgress, [0, 0.2], [0, -50])
    const titleOpacity = useTransform(scrollYProgress, [0, 0.2], [1, 0])

    return (
        <div ref={containerRef} className="min-h-screen bg-[#0a0e1a]">
            <LandingNavbar isLoggedIn={false} />

            <main className="relative">
                {/* Hero Section with Parallax */}
                <section className="relative h-[80vh] flex items-center justify-center overflow-hidden">
                    <motion.div
                        style={{ y: titleY, opacity: titleOpacity }}
                        className="container mx-auto px-6 text-center z-10"
                    >
                        <motion.h1
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-6xl md:text-9xl font-black text-white tracking-tighter mb-8 uppercase"
                        >
                            Mission <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Above All.</span>
                        </motion.h1>

                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.2 }}
                            className="max-w-3xl mx-auto text-xl text-slate-300 font-medium leading-relaxed"
                        >
                            We started JUNO with a simple belief: the global supply chain is broken, and
                            technology is the only way to fix it. We&apos;re building the infrastructure for a
                            more connected, efficient, and transparent future.
                        </motion.p>
                    </motion.div>

                    <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_center,rgba(79,70,229,0.1)_0%,transparent_70%)]" />
                </section>

                {/* Our Vision Section */}
                <section className="container mx-auto px-6 mb-32 grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
                    <motion.div
                        initial={{ opacity: 0, x: -30 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true, margin: "-100px" }}
                        transition={{ duration: 0.8 }}
                    >
                        <h2 className="text-4xl font-black text-white mb-8 tracking-tighter uppercase">Our Vision</h2>
                        <div className="space-y-6 text-slate-300 font-medium text-lg leading-relaxed">
                            <p>
                                Every day, millions of dollars are lost due to inefficient communication,
                                lost inventory data, and slow synchronization.
                            </p>
                            <p>
                                JUNO eliminates these bottlenecks by providing a unified, high-octane
                                platform where data flows as fast as the commerce it supports.
                            </p>
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true, margin: "-100px" }}
                        transition={{ duration: 0.8 }}
                        className="grid grid-cols-2 gap-4"
                    >
                        {[
                            { label: "Members", value: "10K+", icon: Users, delay: 0 },
                            { label: "Countries", value: "120+", icon: Globe, delay: 0.1 },
                            { label: "Uptime", value: "99.9%", icon: Rocket, delay: 0.2 },
                            { label: "Dedicated", value: "100%", icon: Heart, delay: 0.3 }
                        ].map((item, i) => (
                            <div key={item.label} className={`p-8 rounded-3xl bg-white/[0.03] border border-white/10 text-center ${i % 2 !== 0 ? 'mt-8' : ''}`}>
                                <item.icon className="w-8 h-8 text-indigo-400 mx-auto mb-4" />
                                <div className="text-2xl font-black text-white">{item.value}</div>
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.label}</div>
                            </div>
                        ))}
                    </motion.div>
                </section>

                {/* Values Section */}
                <section className="py-32 bg-white/[0.01] border-y border-white/5">
                    <div className="container mx-auto px-6 text-center mb-16">
                        <h2 className="text-4xl font-black text-white mb-4 tracking-tighter uppercase">Core Values</h2>
                        <div className="w-20 h-1 bg-indigo-500 mx-auto rounded-full" />
                    </div>
                    <div className="container mx-auto px-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                        {values.map((v, i) => (
                            <motion.div
                                key={v.title}
                                initial={{ opacity: 0, y: 30 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.1 }}
                                className="p-10 rounded-[40px] bg-white/[0.03] border border-white/10 backdrop-blur-sm group hover:bg-white/[0.05] transition-all"
                            >
                                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${v.color} flex items-center justify-center mb-6 shadow-lg`}>
                                    <v.icon className="w-7 h-7 text-white" />
                                </div>
                                <h3 className="text-xl font-black text-white mb-4 uppercase tracking-tight">{v.title}</h3>
                                <p className="text-slate-300 text-sm font-medium leading-relaxed">{v.description}</p>
                            </motion.div>
                        ))}
                    </div>
                </section>

                {/* Join Movement */}
                <section className="py-32">
                    <div className="container mx-auto px-6 text-center">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            viewport={{ once: true }}
                        >
                            <h2 className="text-5xl md:text-7xl font-black text-white mb-8 tracking-tighter uppercase">Join the Movement</h2>
                            <p className="text-slate-300 font-medium mb-12 max-w-2xl mx-auto text-lg leading-relaxed">
                                We&apos;re always looking for ambitious vendors and suppliers to join our
                                expanding ecosystem. Let&apos;s build the future together.
                            </p>
                            <div className="flex justify-center">
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    className="px-12 py-6 bg-indigo-600 rounded-2xl font-black text-white shadow-2xl shadow-indigo-600/20 transition-all uppercase tracking-widest text-sm"
                                >
                                    GET INVOLVED
                                </motion.button>
                            </div>
                        </motion.div>
                    </div>
                </section>
            </main>

            <LandingFooter />
        </div>
    )
}
