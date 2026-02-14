"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import {
    Package,
    Plus,
    RefreshCcw,
    MoreVertical,
    AlertCircle,
    Hash,
    DollarSign,
    Layers
} from "lucide-react"

// Sample data for this legacy view. For live inventory data, use the Inventory page.
const mockInventory = [
    { id: "1", title: "Neo Wireless Controller", supplier: "Tokyo Tech Hub", price: "$45.00", stock: 120, status: "SYNCED" },
    { id: "2", title: "Smart Home Hub v2", supplier: "Shenzhen Direct", price: "$89.50", stock: 15, status: "LOW STOCK" },
    { id: "3", title: "Leather Tech Folder", supplier: "EuroLogistic SpA", price: "$120.00", stock: 45, status: "SYNCED" },
]

export default function InventoryPage() {
    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white">Active <span className="text-emerald-accent">Inventory</span></h2>
                    <p className="text-zinc-500 text-sm mt-1">Manage products imported from your connected suppliers.</p>
                </div>

                <div className="flex items-center gap-3">
                    <button className="h-11 px-4 bg-zinc-900 border border-white/5 rounded-xl text-zinc-400 hover:text-white transition-colors flex items-center gap-2 text-sm font-bold">
                        <RefreshCcw className="w-4 h-4" /> SYNC ALL
                    </button>
                    <button className="h-11 px-4 bg-emerald-accent text-black rounded-xl hover:bg-emerald-600 transition-all flex items-center gap-2 text-sm font-bold">
                        <Plus className="w-4 h-4" /> ADD PRODUCT
                    </button>
                </div>
            </div>

            <div className="glass rounded-2xl border-white/5 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-white/5 bg-white/[0.02]">
                                <th className="px-3 py-3 md:px-6 md:py-4 text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-widest min-w-[180px]">Product Details</th>
                                <th className="px-3 py-3 md:px-6 md:py-4 text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-widest hidden sm:table-cell">Supplier</th>
                                <th className="px-3 py-3 md:px-6 md:py-4 text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-widest whitespace-nowrap">Price</th>
                                <th className="px-3 py-3 md:px-6 md:py-4 text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-widest hidden md:table-cell">Stock</th>
                                <th className="px-3 py-3 md:px-6 md:py-4 text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-widest hidden lg:table-cell">Status</th>
                                <th className="px-3 py-3 md:px-6 md:py-4 text-right text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-widest">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {mockInventory.map((item, index) => (
                                <motion.tr
                                    key={item.id}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: index * 0.05 }}
                                    className="hover:bg-white/[0.02] transition-colors group"
                                >
                                    <td className="px-3 py-4 md:px-6 md:py-5">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-white/5 flex items-center justify-center text-zinc-600 group-hover:text-emerald-accent transition-colors">
                                                <Package className="w-5 h-5" />
                                            </div>
                                            <span className="text-sm font-bold text-zinc-200">{item.title}</span>
                                        </div>
                                    </td>
                                    <td className="px-3 py-4 md:px-6 md:py-5 hidden sm:table-cell">
                                        <span className="text-xs text-zinc-500 font-medium">{item.supplier}</span>
                                    </td>
                                    <td className="px-3 py-4 md:px-6 md:py-5">
                                        <div className="flex items-center gap-1 text-emerald-accent/90 font-mono text-sm font-bold">
                                            {item.price}
                                        </div>
                                    </td>
                                    <td className="px-3 py-4 md:px-6 md:py-5 hidden md:table-cell">
                                        <div className="flex items-center gap-1.5 font-mono text-xs text-zinc-400">
                                            <Layers className="w-3.5 h-3.5" />
                                            {item.stock}
                                        </div>
                                    </td>
                                    <td className="px-3 py-4 md:px-6 md:py-5 hidden lg:table-cell">
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${item.status === 'LOW STOCK'
                                                ? 'bg-amber-500/10 text-amber-500'
                                                : 'bg-emerald-500/10 text-emerald-500'
                                            }`}>
                                            {item.status}
                                        </span>
                                    </td>
                                    <td className="px-3 py-4 md:px-6 md:py-5 text-right">
                                        <button className="p-2 text-zinc-600 hover:text-white transition-colors">
                                            <MoreVertical className="w-4 h-4" />
                                        </button>
                                    </td>
                                </motion.tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Sample analytics – real data is on the Inventory page */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass p-6 rounded-2xl border-white/5 flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-emerald-accent/10 text-emerald-accent">
                        <Hash className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="text-[10px] font-bold text-zinc-600 uppercase">Total Items</div>
                        <div className="text-lg font-bold text-white">184</div>
                    </div>
                </div>
                <div className="glass p-6 rounded-2xl border-white/5 flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-lime-accent/10 text-lime-accent">
                        <DollarSign className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="text-[10px] font-bold text-zinc-600 uppercase">Inventory Value</div>
                        <div className="text-lg font-bold text-white">$42,300</div>
                    </div>
                </div>
                <div className="glass p-6 rounded-2xl border-white/5 flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-red-400/10 text-red-400">
                        <AlertCircle className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="text-[10px] font-bold text-zinc-600 uppercase">Stock Alerts</div>
                        <div className="text-lg font-bold text-white">3 High Priority</div>
                    </div>
                </div>
            </div>
            <p className="text-center text-xs text-zinc-500 mt-4">
                Sample data. View live inventory and sync status on the{" "}
                <Link href="/dashboard/inventory" className="text-indigo-400 hover:underline font-medium">
                    Inventory page
                </Link>.
            </p>
        </div>
    )
}
