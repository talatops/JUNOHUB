"use client"

import { useEffect, useState } from "react"
import {
    Users,
    Search,
    MoreHorizontal,
    Mail,
    Plus,
    Loader2,
    AlertCircle,
    MapPin
} from "lucide-react"

interface ShopifyCustomer {
    id: number
    email: string
    first_name: string
    last_name: string
    orders_count: number
    state: string
    total_spent: string
    last_order_id: number | null
    created_at: string
    default_address: {
        city?: string
        country_name?: string
        country?: string
        province?: string
        address1?: string
    } | null
}

function formatCustomerLocation(default_address: ShopifyCustomer["default_address"]): string {
    if (!default_address) return "Not provided"
    const city = (default_address.city || "").trim()
    const country = (default_address.country_name || default_address.country || "").trim()
    if (city && country) return `${city}, ${country}`
    if (city) return city
    if (country) return country
    const prov = (default_address.province || "").trim()
    if (prov) return prov
    const line = (default_address.address1 || "").trim()
    if (line) return line
    return "Not provided"
}

export default function CustomersPage() {
    const [customers, setCustomers] = useState<ShopifyCustomer[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState("")
    const [searchTerm, setSearchTerm] = useState("")

    useEffect(() => {
        const fetchCustomers = async () => {
            try {
                const res = await fetch("/api/shopify/customers")
                if (!res.ok) throw new Error("Failed to fetch customers")
                const data = await res.json()
                setCustomers(data.customers || [])
                setError("")
            } catch {
                setError("Could not load customers. Please ensure your Shopify store is connected.")
            } finally {
                setLoading(false)
            }
        }
        
        // Initial fetch
        fetchCustomers()

        // Auto-refresh every 20 seconds to catch webhook updates
        const interval = setInterval(() => {
            fetchCustomers()
        }, 20000) // 20 seconds

        return () => clearInterval(interval)
    }, [])

    const filteredCustomers = customers.filter(c =>
        `${c.first_name} ${c.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.email.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <div className="h-full flex flex-col space-y-4 md:space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 flex-shrink-0">
                <div>
                    <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">Customers</h1>
                    <p className="text-sm md:text-base text-slate-400 mt-1">View and manage your Shopify customer base.</p>
                </div>
                <div className="flex gap-3">
                    <button className="h-10 md:h-11 px-4 md:px-6 bg-indigo-500 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-600 border border-indigo-400/20 transition-all text-sm">
                        <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Add Customer</span>
                    </button>
                </div>
            </div>

            <div className="bg-white/5 backdrop-blur-xl rounded-xl md:rounded-2xl border border-white/10 overflow-hidden flex flex-col flex-1 min-h-0">
                <div className="p-4 md:p-6 border-b border-white/10 flex flex-col sm:flex-row gap-3 md:gap-4 justify-between bg-white/5 flex-shrink-0">
                    <div className="relative flex-1 min-w-0">
                        <Search className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Search by name or email..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full h-10 md:h-11 pl-10 md:pl-11 pr-4 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 text-white placeholder:text-slate-500 text-sm font-medium transition-all"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto overflow-x-auto -mx-4 md:mx-0">
                    <div className="min-w-full px-4 md:px-0">
                    {loading ? (
                        <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-3">
                            <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
                            <p className="font-medium animate-pulse">Loading customers...</p>
                        </div>
                    ) : error ? (
                        <div className="h-64 flex flex-col items-center justify-center text-red-400 gap-4 p-8 text-center">
                            <div className="w-12 h-12 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center">
                                <AlertCircle className="w-6 h-6" />
                            </div>
                            <p className="font-bold">{error}</p>
                        </div>
                    ) : filteredCustomers.length === 0 ? (
                        <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-3">
                            <Users className="w-10 h-10 opacity-20" />
                            <p className="font-medium">No customers found.</p>
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-white/5 border-b border-white/10">
                                    <th className="px-4 md:px-8 py-3 md:py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest min-w-[200px]">Customer</th>
                                    <th className="px-3 md:px-6 py-3 md:py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Orders</th>
                                    <th className="px-3 md:px-6 py-3 md:py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Spent</th>
                                    <th className="px-3 md:px-6 py-3 md:py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap hidden md:table-cell">Location</th>
                                    <th className="px-3 md:px-6 py-3 md:py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap hidden lg:table-cell">Member Since</th>
                                    <th className="px-4 md:px-8 py-3 md:py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {filteredCustomers.map((customer) => (
                                    <tr key={customer.id} className="hover:bg-white/5 transition-colors group">
                                        <td className="px-4 md:px-8 py-3 md:py-4">
                                            <div className="flex items-center gap-2 md:gap-3">
                                                <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-white/10 flex items-center justify-center border border-white/10 font-bold text-slate-400 shrink-0">
                                                    {customer.first_name?.[0]}{customer.last_name?.[0]}
                                                </div>
                                                <div className="flex flex-col min-w-0 flex-1">
                                                    <span className="font-bold text-sm md:text-base text-white truncate">{customer.first_name} {customer.last_name}</span>
                                                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium">
                                                        <Mail className="w-3 h-3 shrink-0" />
                                                        <span className="truncate">{customer.email}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium md:hidden mt-1">
                                                        <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                                                        <span className="truncate">{formatCustomerLocation(customer.default_address)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-3 md:px-6 py-3 md:py-4 text-center">
                                            <div className="px-2 py-1 bg-indigo-500/20 text-indigo-400 rounded-lg inline-flex items-center gap-1.5 font-black text-[10px]">
                                                {customer.orders_count} ORDERS
                                            </div>
                                        </td>
                                        <td className="px-3 md:px-6 py-3 md:py-4">
                                            <span className="text-xs md:text-sm font-black text-white">${customer.total_spent}</span>
                                        </td>
                                        <td className="px-3 md:px-6 py-3 md:py-4 hidden md:table-cell">
                                            <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                                                <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                                                <span className="truncate">{formatCustomerLocation(customer.default_address)}</span>
                                            </div>
                                        </td>
                                        <td className="px-3 md:px-6 py-3 md:py-4 hidden lg:table-cell">
                                            <span className="text-xs text-slate-500 font-medium">{new Date(customer.created_at).toLocaleDateString()}</span>
                                        </td>
                                        <td className="px-4 md:px-8 py-3 md:py-4 text-right">
                                            <button className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-indigo-400 transition-all">
                                                <MoreHorizontal className="w-4 h-4 md:w-5 md:h-5" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
