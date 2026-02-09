"use client"

import { Globe } from "lucide-react"
import { useRouter } from "next/navigation"

export default function SuppliersPage() {
    const router = useRouter()

    return (
        <div className="space-y-6 md:space-y-10">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">Suppliers</h1>
                    <p className="text-sm md:text-base text-slate-400 font-medium mt-1">Discover and manage your supply chain partners.</p>
                </div>
            </div>

            <div className="flex gap-3 md:gap-4 border-b border-white/10 overflow-x-auto">
                <button
                    onClick={() => router.push("/dashboard/suppliers/my")}
                    className="pb-3 md:pb-4 px-2 font-bold text-indigo-400 border-b-2 border-indigo-500 transition-all hover:text-indigo-300 whitespace-nowrap text-sm md:text-base"
                >
                    My Suppliers
                </button>
                <button
                    onClick={() => router.push("/dashboard/suppliers/global")}
                    className="pb-3 md:pb-4 px-2 font-bold text-slate-400 hover:text-white transition-all whitespace-nowrap text-sm md:text-base"
                >
                    Discover Global
                </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                <div className="bg-white/5 backdrop-blur-xl p-6 md:p-8 rounded-xl md:rounded-2xl border border-white/10 flex flex-col items-center text-center space-y-4 md:space-y-6 group hover:bg-white/[0.07] hover:border-indigo-500/30 transition-all">
                    <div className="w-16 h-16 md:w-20 md:h-20 bg-white/10 rounded-xl md:rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-indigo-500/30 group-hover:text-indigo-300 border border-white/10 transition-all">
                        <Globe className="w-8 h-8 md:w-10 md:h-10" />
                    </div>
                    <div className="space-y-2">
                        <h3 className="text-lg md:text-xl font-extrabold text-white tracking-tight">Expand Your Network</h3>
                        <p className="text-xs md:text-sm text-slate-400 leading-relaxed">Browse our verified global supply chain to find high-quality products for your store.</p>
                    </div>
                    <button
                        onClick={() => router.push("/dashboard/suppliers/global")}
                        className="w-full h-11 md:h-12 rounded-xl bg-indigo-500 text-white font-bold hover:bg-indigo-600 border border-indigo-400/20 transition-all text-sm md:text-base"
                    >
                        Browse Marketplace
                    </button>
                </div>
            </div>
        </div>
    )
}
