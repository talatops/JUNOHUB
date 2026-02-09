"use client"

import { useSession } from "next-auth/react"
import { motion } from "framer-motion"
import {
    Package,
    Plus,
    Search,
    Filter,
    Edit,
    Trash2,
    Eye
} from "lucide-react"

const mockProducts = [
    { id: "1", title: "Wireless Noise Cancelling Headphones", category: "Electronics", price: "$45.00", stock: 1200, status: "PUBLISHED" },
    { id: "2", title: "Ergonomic Mechanical Keyboard", category: "Electronics", price: "$65.00", stock: 450, status: "DRAFT" },
    { id: "3", title: "Smart LED Desk Lamp", category: "Home", price: "$22.50", stock: 800, status: "PUBLISHED" },
]

export default function SupplierProductsPage() {
    useSession()

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white">Product <span className="text-emerald-accent">Source</span></h2>
                    <p className="text-zinc-500 text-sm mt-1">Manage your global inventory and distribution catalog.</p>
                </div>

                <div className="flex items-center gap-3">
                    <button className="h-11 px-4 bg-emerald-accent text-black rounded-xl hover:bg-emerald-600 transition-all flex items-center gap-2 text-sm font-bold shadow-lg shadow-emerald-500/10">
                        <Plus className="w-4 h-4" /> ADD NEW PRODUCT
                    </button>
                </div>
            </div>

            <div className="flex items-center gap-4 bg-zinc-900/50 p-4 rounded-2xl border border-white/5">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                        placeholder="Search by SKU or name..."
                        className="w-full h-10 bg-black/40 border-none rounded-lg pl-10 pr-4 text-xs text-white placeholder:text-zinc-600 focus:ring-1 focus:ring-emerald-accent/30"
                    />
                </div>
                <button className="px-4 h-10 border border-white/10 rounded-lg text-xs font-bold text-zinc-400 hover:text-white transition-colors flex items-center gap-2">
                    <Filter className="w-4 h-4" /> FILTERS
                </button>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {mockProducts.map((product, index) => (
                    <motion.div
                        key={product.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="glass p-4 rounded-2xl border-white/5 hover:border-emerald-accent/10 transition-all flex items-center gap-6 group"
                    >
                        <div className="w-16 h-16 rounded-xl bg-zinc-900 border border-white/5 flex items-center justify-center text-zinc-600 group-hover:text-emerald-accent transition-all">
                            <Package className="w-8 h-8" />
                        </div>

                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-1">
                                <h3 className="font-bold text-zinc-200 truncate">{product.title}</h3>
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${product.status === 'PUBLISHED'
                                        ? 'bg-emerald-500/10 text-emerald-500'
                                        : 'bg-zinc-800 text-zinc-500'
                                    }`}>
                                    {product.status}
                                </span>
                            </div>
                            <div className="flex items-center gap-4 text-[10px] text-zinc-500 font-mono tracking-tight uppercase">
                                <span>SKU: {product.id}00-TX</span>
                                <span className="w-1 h-1 rounded-full bg-zinc-800" />
                                <span>{product.category}</span>
                            </div>
                        </div>

                        <div className="text-right px-4 hidden sm:block">
                            <div className="text-xs text-zinc-600 uppercase font-mono font-bold mb-1">Unit Price</div>
                            <div className="text-lg font-bold text-emerald-accent">{product.price}</div>
                        </div>

                        <div className="text-right px-4 hidden md:block">
                            <div className="text-xs text-zinc-600 uppercase font-mono font-bold mb-1">In Stock</div>
                            <div className="text-lg font-bold text-white">{product.stock}</div>
                        </div>

                        <div className="flex items-center gap-2">
                            <button className="p-2 bg-white/5 hover:bg-emerald-accent/10 hover:text-emerald-accent rounded-lg text-zinc-500 transition-all">
                                <Eye className="w-4 h-4" />
                            </button>
                            <button className="p-2 bg-white/5 hover:bg-zinc-800 rounded-lg text-zinc-500 transition-all">
                                <Edit className="w-4 h-4" />
                            </button>
                            <button className="p-2 bg-white/5 hover:bg-red-500/10 hover:text-red-400 rounded-lg text-zinc-500 transition-all">
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    )
}
