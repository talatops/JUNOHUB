"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import toast from "react-hot-toast"
import {
    ShoppingCart,
    Search,
    Filter,
    Calendar,
    Download,
    Loader2,
    AlertCircle,
    ShoppingBag,
    User,
    CheckCircle2,
    Clock,
    MoreHorizontal,
    Eye,
    ExternalLink,
    Copy,
    ChevronLeft,
    ChevronRight
} from "lucide-react"

interface ShopifyOrder {
    id: number
    name: string
    email: string
    created_at: string
    total_price: string
    currency: string
    financial_status: string
    fulfillment_status: string | null
    pending_vendor_sync?: boolean
    customer: {
        first_name: string
        last_name: string
        email: string
    } | null
    line_items: unknown[]
}

export default function OrdersPage() {
    const router = useRouter()
    const [orders, setOrders] = useState<ShopifyOrder[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState("")
    const [searchTerm, setSearchTerm] = useState("")
    const [openMenuId, setOpenMenuId] = useState<number | null>(null)
    const [storeDomain, setStoreDomain] = useState<string | null>(null)
    const [statusFilter, setStatusFilter] = useState<string>("all")
    const menuRefs = useRef<{ [key: number]: HTMLDivElement | null }>({})

    useEffect(() => {
        const fetchStoreInfo = async () => {
            try {
                const res = await fetch("/api/stores")
                if (res.ok) {
                    const data = await res.json()
                    const activeStore = data.stores?.find((s: { isActive: boolean }) => s.isActive)
                    if (activeStore?.shopifyDomain) {
                        const cleanDomain = activeStore.shopifyDomain.replace(/^https?:\/\//, "").replace(/\/$/, "")
                        setStoreDomain(cleanDomain)
                    }
                }
            } catch {
                // Silent fail
            }
        }

        const fetchOrders = async () => {
            try {
                const res = await fetch("/api/shopify/orders")
                if (!res.ok) throw new Error("Failed to fetch orders")
                const data = await res.json()
                setOrders(data.orders || [])
                setError("")
            } catch {
                setError("Could not load orders. Please ensure your Shopify store is connected.")
            } finally {
                setLoading(false)
            }
        }

        // Fetch store info and orders
        fetchStoreInfo()
        fetchOrders()

        // Auto-refresh every 15 seconds to catch webhook updates
        const interval = setInterval(() => {
            fetchOrders()
        }, 15000) // 15 seconds

        return () => clearInterval(interval)
    }, [])

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (openMenuId !== null) {
                const menuElement = menuRefs.current[openMenuId]
                if (menuElement && !menuElement.contains(event.target as Node)) {
                    setOpenMenuId(null)
                }
            }
        }

        if (openMenuId !== null) {
            document.addEventListener("mousedown", handleClickOutside)
            return () => document.removeEventListener("mousedown", handleClickOutside)
        }
    }, [openMenuId])

    const handleMenuToggle = (orderId: number) => {
        setOpenMenuId(openMenuId === orderId ? null : orderId)
    }

    const handleViewDetails = (order: ShopifyOrder) => {
        router.push(`/dashboard/orders/${order.id}`)
        setOpenMenuId(null)
    }

    const handleViewInShopify = (orderId: number) => {
        if (storeDomain) {
            window.open(`https://${storeDomain}/admin/orders/${orderId}`, "_blank")
        } else {
            toast.error("Store domain not found. Please check your store configuration.")
        }
        setOpenMenuId(null)
    }

    const handleCopyOrderId = (orderId: number) => {
        navigator.clipboard.writeText(orderId.toString())
        toast.success("Order ID copied to clipboard")
        setOpenMenuId(null)
    }

    const handleExport = () => {
        const csvHeaders = ["Order #", "Customer", "Email", "Date", "Total", "Currency", "Payment Status", "Fulfillment Status"]
        const csvRows = filteredOrders.map(o => [
            o.name,
            o.customer ? `"${o.customer.first_name} ${o.customer.last_name}"` : "",
            o.email || "",
            new Date(o.created_at).toLocaleDateString(),
            o.total_price,
            o.currency,
            o.financial_status,
            o.fulfillment_status || "unfulfilled"
        ])

        const csvContent = [
            csvHeaders.join(","),
            ...csvRows.map(row => row.join(","))
        ].join("\n")

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
        const link = document.createElement("a")
        const url = URL.createObjectURL(blob)
        link.setAttribute("href", url)
        link.setAttribute("download", `orders-${new Date().toISOString().split("T")[0]}.csv`)
        link.style.visibility = "hidden"
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        toast.success("Orders exported successfully")
    }

    const filteredOrders = orders.filter(o => {
        const matchesSearch = o.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (o.customer && `${o.customer.first_name} ${o.customer.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()))
        const matchesStatus = statusFilter === "all" ||
            (statusFilter === "fulfilled" && o.fulfillment_status === "fulfilled") ||
            (statusFilter === "unfulfilled" && (!o.fulfillment_status || o.fulfillment_status !== "fulfilled")) ||
            (statusFilter === "paid" && o.financial_status === "paid") ||
            (statusFilter === "unpaid" && o.financial_status !== "paid")
        return matchesSearch && matchesStatus
    })

    const getStatusStyles = (status: string | null) => {
        const normalized = (status || "").trim().toLowerCase()
        switch (normalized) {
            case "fulfilled": return "bg-emerald-500/20 text-emerald-400"
            case "partial": return "bg-yellow-500/20 text-yellow-400"
            default:
                if (normalized === "on_hold" || normalized === "on hold") {
                    return "bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/35"
                }
                return "bg-blue-500/20 text-blue-400"
        }
    }

    return (
        <div className="h-full flex flex-col space-y-4 md:space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 flex-shrink-0">
                <div>
                    <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">Orders</h1>
                    <p className="text-sm md:text-base text-slate-400 mt-1">Track and manage your Shopify orders for fulfillment.</p>
                </div>
                <div className="flex gap-2 md:gap-3">
                    <button className="h-10 md:h-11 px-3 md:px-6 bg-white/10 border border-white/10 rounded-xl font-bold text-white hover:bg-white/15 backdrop-blur-sm transition-all flex items-center gap-2 text-sm">
                        <Calendar className="w-4 h-4" /> <span className="hidden sm:inline">This Month</span>
                    </button>
                    <button
                        onClick={handleExport}
                        className="h-10 md:h-11 px-4 md:px-6 bg-indigo-500 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-600 border border-indigo-400/20 transition-all text-sm"
                    >
                        <Download className="w-4 h-4" /> <span className="hidden sm:inline">Export CSV</span>
                    </button>
                </div>
            </div>

            {/* Search and Filter Controls */}
            <div className="flex flex-col sm:flex-row gap-3 md:gap-4 flex-shrink-0">
                <div className="relative flex-1 min-w-0">
                    <Search className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                        type="text"
                        placeholder="Search order #, customer name..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full h-10 md:h-11 pl-10 md:pl-11 pr-4 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 text-white placeholder:text-slate-500 text-sm font-medium transition-all"
                    />
                </div>
                <div className="flex gap-2">
                    <select
                        value={statusFilter}
                        onChange={(e) => {
                            setStatusFilter(e.target.value)
                        }}
                        className="h-10 md:h-11 px-4 bg-white/10 border border-white/10 rounded-xl font-bold text-slate-300 hover:bg-white/15 transition-all text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                    >
                        <option value="all">All Statuses</option>
                        <option value="fulfilled">Fulfilled</option>
                        <option value="unfulfilled">Unfulfilled</option>
                        <option value="paid">Paid</option>
                        <option value="unpaid">Unpaid</option>
                    </select>
                </div>
            </div>

            {/* Orders Grid */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
                {loading ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3">
                        <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
                        <p className="font-medium animate-pulse">Fetching latest orders...</p>
                    </div>
                ) : error ? (
                    <div className="h-full flex flex-col items-center justify-center text-red-400 gap-4 p-8 text-center">
                        <div className="w-12 h-12 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center">
                            <AlertCircle className="w-6 h-6" />
                        </div>
                        <p className="font-bold">{error}</p>
                    </div>
                ) : filteredOrders.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3">
                        <ShoppingCart className="w-10 h-10 opacity-20" />
                        <p className="font-medium">No orders found.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6 h-full content-start">
                        {filteredOrders.map((order) => (
                            <div
                                key={order.id}
                                className="bg-white/5 rounded-xl border border-white/10 p-5 hover:bg-white/10 hover:border-indigo-500/30 transition-all cursor-pointer group relative"
                                onClick={() => handleViewDetails(order)}
                            >
                                {/* Order Header */}
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <div className="w-10 h-10 rounded-lg bg-indigo-500/20 border border-indigo-400/20 flex items-center justify-center text-indigo-400 group-hover:bg-indigo-500/30 transition-all shrink-0">
                                            <ShoppingBag className="w-5 h-5" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-black text-base text-white truncate">{order.name}</h3>
                                            <p className="text-xs text-slate-400 mt-0.5">
                                                {new Date(order.created_at).toLocaleDateString()} • {new Date(order.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="relative shrink-0" onClick={(e) => e.stopPropagation()} ref={(el) => { menuRefs.current[order.id] = el }}>
                                        <button
                                            onClick={() => handleMenuToggle(order.id)}
                                            className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-indigo-400 transition-all"
                                        >
                                            <MoreHorizontal className="w-4 h-4" />
                                        </button>
                                        {openMenuId === order.id && (
                                            <div className="absolute right-0 top-full mt-1 bg-slate-800/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-xl overflow-hidden z-[200] min-w-[180px] whitespace-nowrap">
                                                <button
                                                    onClick={() => handleViewDetails(order)}
                                                    className="w-full px-4 py-2.5 text-left text-sm font-medium text-slate-200 hover:bg-indigo-500 hover:text-white transition-colors flex items-center gap-2"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                    Details
                                                </button>
                                                <button
                                                    onClick={() => handleViewInShopify(order.id)}
                                                    className="w-full px-4 py-2.5 text-left text-sm font-medium text-slate-200 hover:bg-indigo-500 hover:text-white transition-colors flex items-center gap-2"
                                                >
                                                    <ExternalLink className="w-4 h-4" />
                                                    Show on Shopify
                                                </button>
                                                <button
                                                    onClick={() => handleCopyOrderId(order.id)}
                                                    className="w-full px-4 py-2.5 text-left text-sm font-medium text-slate-200 hover:bg-indigo-500 hover:text-white transition-colors flex items-center gap-2"
                                                >
                                                    <Copy className="w-4 h-4" />
                                                    Copy Order ID
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Customer Info */}
                                {order.customer && (
                                    <div className="flex items-center gap-2 mb-4">
                                        <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                                            <User className="w-3.5 h-3.5 text-slate-400" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-white truncate">
                                                {order.customer.first_name} {order.customer.last_name}
                                            </p>
                                            <p className="text-xs text-slate-400 truncate">{order.email}</p>
                                        </div>
                                    </div>
                                )}

                                {/* Order Details */}
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total</span>
                                        <span className="text-lg font-black text-white">{order.total_price} {order.currency}</span>
                                    </div>

                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1.5 ${order.financial_status === "paid"
                                                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                                : "bg-red-500/20 text-red-400 border border-red-500/30"
                                            }`}>
                                            {order.financial_status === "paid" && <CheckCircle2 className="w-3 h-3" />}
                                            Payment: {order.financial_status}
                                        </span>
                                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1.5 ${getStatusStyles(order.fulfillment_status)}`}>
                                            {(order.fulfillment_status || "").trim().toLowerCase() === "fulfilled" ? (
                                                <CheckCircle2 className="w-3 h-3" />
                                            ) : (
                                                <Clock className="w-3 h-3" />
                                            )}
                                            {(order.fulfillment_status || "").trim().toLowerCase() === "on_hold" ||
                                            (order.fulfillment_status || "").trim().toLowerCase() === "on hold"
                                                ? "On hold"
                                                : order.fulfillment_status || "Unfulfilled"}
                                        </span>
                                        {order.pending_vendor_sync && (
                                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1.5 bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
                                                Pending Sync
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
