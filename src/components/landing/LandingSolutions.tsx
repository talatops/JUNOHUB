"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { CheckCircle2, ArrowRight } from "lucide-react"

const solutions = [
    {
        role: "For Vendors",
        title: "Scale your reach, simplify your supply.",
        description: "Connect with global suppliers, sync your Shopify store, and manage orders from a single, high-performance interface.",
        features: [
            "Seamless Shopify Integration",
            "Real-time Inventory Tracking",
            "Direct Encrypted Chat with Suppliers",
            "Unified Order Management"
        ],
        cta: "Sign Up as Vendor",
        gradient: "from-blue-600 to-indigo-600",
        bg: "bg-blue-500/5"
    },
    {
        role: "For Suppliers",
        title: "Your products, in every shopify window.",
        description: "Distribute your catalog to thousands of vendors instantly. Track performance and communicate securely with your partners.",
        features: [
            "Global Catalog Distribution",
            "Automated Product Syncing",
            "Detailed Partner Analytics",
            "Reliable Payment Settlements"
        ],
        cta: "Sign Up as Supplier",
        gradient: "from-indigo-600 to-purple-600",
        bg: "bg-purple-500/5"
    }
]

export function LandingSolutions() {
    return (
        <section id="solutions" className="py-24 bg-white/5 border-y border-white/5 relative">
            <div className="container mx-auto px-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                    {solutions.map((sol, index) => (
                        <motion.div
                            key={sol.role}
                            initial={{ opacity: 0, x: index === 0 ? -20 : 20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            className={`p-10 rounded-[40px] border border-white/10 ${sol.bg} relative overflow-hidden group`}
                        >
                            {/* Role Badge */}
                            <div className="inline-block px-4 py-1.5 rounded-full bg-white/10 border border-white/10 text-xs font-black uppercase tracking-widest text-white mb-6">
                                {sol.role}
                            </div>

                            <h3 className="text-3xl md:text-4xl font-black text-white mb-6 leading-tight tracking-tighter uppercase">
                                {sol.title}
                            </h3>

                            <p className="text-slate-300 font-medium mb-8 text-lg">
                                {sol.description}
                            </p>

                            <ul className="space-y-4 mb-10">
                                {sol.features.map((feat) => (
                                    <li key={feat} className="flex items-center gap-3 text-slate-300 font-bold">
                                        <CheckCircle2 className="w-5 h-5 text-indigo-400" />
                                        {feat}
                                    </li>
                                ))}
                            </ul>

                            <Link
                                href={sol.role === "For Vendors" ? "/signup?role=vendor" : "/signup?role=supplier"}
                                className={`w-full py-5 rounded-2xl bg-gradient-to-r ${sol.gradient} text-white font-black shadow-xl shadow-indigo-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 group`}
                            >
                                {sol.cta} <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </Link>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    )
}
