"use client"

import { useEffect, useState, useRef } from "react"
import Image from "next/image"
import toast from "react-hot-toast"
import {
    Package,
    Search,
    Filter,
    MoreHorizontal,
    Download,
    Loader2,
    AlertCircle,
    Image as ImageIcon,
    Eye,
    ExternalLink,
    Copy,
    RefreshCw,
    X,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    Plus,
    PackagePlus,
} from "lucide-react"
import { createPortal } from "react-dom"
import { motion, AnimatePresence } from "framer-motion"
import { useTheme } from "@/components/ThemeProvider"

interface ShopifyProduct {
    id: number
    title: string
    body_html: string
    vendor: string
    product_type: string
    created_at: string
    handle: string
    updated_at: string
    published_at: string
    template_suffix: string
    status: string
    published_scope: string
    tags: string
    admin_graphql_api_id: string
    variants: unknown[]
    options: unknown[]
    images: { src: string }[]
    image: { src: string } | null
}

interface ProductSync {
    id: string
    shopifyProductId: string
    shopifyProductTitle: string
    status: "PENDING" | "ACCEPTED" | "REJECTED"
    supplier: {
        id: string
        companyName: string
    }
    /** Set by GET /api/products/sync when status is ACCEPTED (from JSON or offer match). */
    supplierAvailableQuantity?: number | null
}

interface Supplier {
    id: string
    companyName: string
    description: string | null
    user: {
        email: string
    }
    connectionStatus: "NONE" | "PENDING" | "CONNECTED" | "REJECTED"
}

/** Sum variant inventory_quantity from Shopify REST/cache payload. */
function totalShopifyInventory(variants: unknown): string {
    if (!Array.isArray(variants) || variants.length === 0) return "—"
    let total = 0
    let hasQty = false
    for (const v of variants) {
        if (v && typeof v === "object" && v !== null && "inventory_quantity" in v) {
            const raw = (v as { inventory_quantity?: unknown }).inventory_quantity
            if (raw !== null && raw !== undefined && raw !== "") {
                const n = Number(raw)
                if (!Number.isNaN(n)) {
                    total += n
                    hasQty = true
                }
            }
        }
    }
    if (!hasQty) return "—"
    return String(total)
}

export default function InventoryPage() {
    const [products, setProducts] = useState<ShopifyProduct[]>([])
    const [productSyncs, setProductSyncs] = useState<Map<string, ProductSync>>(new Map())
    const [connectedSuppliers, setConnectedSuppliers] = useState<Supplier[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState("")
    const [searchTerm, setSearchTerm] = useState("")
    const [openMenuId, setOpenMenuId] = useState<number | null>(null)
    const [storeDomain, setStoreDomain] = useState<string | null>(null)
    const [selectedProduct, setSelectedProduct] = useState<ShopifyProduct | null>(null)
    const [showSupplierModal, setShowSupplierModal] = useState(false)
    const [syncingProduct, setSyncingProduct] = useState(false)
    const [statusFilter, setStatusFilter] = useState<string>("all")
    const [vendorFilter, setVendorFilter] = useState<string>("all")
    const [showFilters, setShowFilters] = useState(false)
    const [mounted, setMounted] = useState(false)
    const [menuRect, setMenuRect] = useState<{ top: number; left: number } | null>(null)
    const [showLoadStockModal, setShowLoadStockModal] = useState(false)
    const [loadStockProduct, setLoadStockProduct] = useState<ShopifyProduct | null>(null)
    const [loadStockSync, setLoadStockSync] = useState<ProductSync | null>(null)
    const [loadStockQtyInput, setLoadStockQtyInput] = useState("1")
    const [loadStockSubmitting, setLoadStockSubmitting] = useState(false)
    const [loadStockError, setLoadStockError] = useState("")
    const menuRefs = useRef<{ [key: number]: HTMLButtonElement | null }>({})
    const { theme } = useTheme()
    const isLight = theme === "light"

    useEffect(() => {
        setMounted(true)
    }, [])

    const refetchInventoryAndSyncs = async () => {
        try {
            const invRes = await fetch("/api/shopify/inventory")
            if (invRes.ok) {
                const invData = await invRes.json()
                setProducts(invData.products || [])
            }
            const syncRes = await fetch("/api/products/sync")
            if (syncRes.ok) {
                const syncData = await syncRes.json()
                const syncsMap = new Map<string, ProductSync>()
                syncData.syncs?.forEach((sync: ProductSync) => {
                    syncsMap.set(sync.shopifyProductId, sync)
                })
                setProductSyncs(syncsMap)
            }
        } catch {
            // Silent fail
        }
    }

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
                // Silent fail - store domain not critical
            }
        }

        const fetchInventory = async () => {
            try {
                const res = await fetch("/api/shopify/inventory")
                if (!res.ok) throw new Error("Failed to fetch inventory")
                const data = await res.json()
                setProducts(data.products || [])
                setError("")
            } catch {
                setError("Could not load inventory. Please ensure your Shopify store is connected and permissions are correct.")
            } finally {
                setLoading(false)
            }
        }

        const fetchProductSyncs = async () => {
            try {
                const res = await fetch("/api/products/sync")
                if (res.ok) {
                    const data = await res.json()
                    const syncsMap = new Map<string, ProductSync>()
                    data.syncs?.forEach((sync: ProductSync) => {
                        syncsMap.set(sync.shopifyProductId, sync)
                    })
                    setProductSyncs(syncsMap)
                }
            } catch {
                // Silent fail - syncs not critical for initial load
            }
        }

        const fetchConnectedSuppliers = async () => {
            try {
                // First get the active store
                const storeRes = await fetch("/api/stores")
                if (!storeRes.ok) return

                const storeData = await storeRes.json()
                const activeStore = storeData.stores?.find((s: { isActive: boolean }) => s.isActive)

                if (!activeStore) {
                    setConnectedSuppliers([])
                    return
                }

                // Then get suppliers filtered by active store
                const res = await fetch("/api/vendors/suppliers/my")
                if (res.ok) {
                    const data = await res.json()
                    // Only show CONNECTED suppliers for the active store

                    const connected = data.connections?.filter(
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        (c: any) => c.status === "CONNECTED" &&
                            c.supplier &&
                            c.store?.id === activeStore.id
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    ).map((c: any) => c.supplier) || []

                    // Remove duplicates by supplier ID (in case of any edge cases)
                    const uniqueSuppliers = Array.from(
                        new Map(connected.map((s: Supplier) => [s.id, s])).values()
                    )

                    setConnectedSuppliers(uniqueSuppliers as Supplier[])
                }
            } catch {
                // Silent fail - suppliers not critical for initial load
            }
        }

        // Fetch store info, inventory, syncs, and suppliers
        fetchStoreInfo()
        fetchInventory()
        fetchProductSyncs()
        fetchConnectedSuppliers()

        // Auto-refresh every 10 seconds to catch webhook updates
        const interval = setInterval(() => {
            fetchInventory()
            fetchProductSyncs()
            fetchConnectedSuppliers()
        }, 10000) // 10 seconds

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

    const handleMenuToggle = (productId: number, e: React.MouseEvent) => {
        e.stopPropagation()
        if (openMenuId === productId) {
            setOpenMenuId(null)
            setMenuRect(null)
        } else {
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
            setMenuRect({
                top: rect.bottom + window.scrollY,
                left: rect.right + window.scrollX
            })
            setOpenMenuId(productId)
        }
    }

    const handleViewProduct = (product: ShopifyProduct) => {
        if (storeDomain) {
            window.open(`https://${storeDomain}/admin/products/${product.id}`, "_blank")
        } else {
            toast.error("Store domain not found. Please check your store configuration.")
        }
        setOpenMenuId(null)
    }

    const handleCopyProductId = (productId: number) => {
        navigator.clipboard.writeText(productId.toString())
        toast.success("Product ID copied to clipboard")
        setOpenMenuId(null)
    }

    const handleRefreshProduct = async () => {
        // Trigger a refresh for products
        try {
            const res = await fetch("/api/shopify/inventory")
            if (res.ok) {
                const data = await res.json()
                setProducts(data.products || [])
            }
        } catch {
            // Silent fail
        }
        setOpenMenuId(null)
    }

    const isProductSynced = (productId: number): ProductSync | null => {
        const sync = productSyncs.get(productId.toString())
        return sync && sync.status === "ACCEPTED" ? sync : null
    }

    const getProductSyncStatus = (productId: number): ProductSync | null => {
        return productSyncs.get(productId.toString()) || null
    }

    const handleOpenLoadStock = (product: ShopifyProduct, sync: ProductSync) => {
        setLoadStockProduct(product)
        setLoadStockSync(sync)
        setLoadStockQtyInput("1")
        setLoadStockError("")
        setShowLoadStockModal(true)
        setOpenMenuId(null)
        setMenuRect(null)
    }

    const handleSubmitLoadStock = async () => {
        if (!loadStockProduct || !loadStockSync) return
        const qty = parseInt(loadStockQtyInput, 10)
        if (!Number.isFinite(qty) || qty < 1) {
            setLoadStockError("Enter a positive whole number.")
            return
        }
        const cap = loadStockSync.supplierAvailableQuantity
        if (cap != null && qty > cap) {
            setLoadStockError(`Amount cannot exceed supplier stock (${cap}).`)
            return
        }
        setLoadStockSubmitting(true)
        setLoadStockError("")
        try {
            const res = await fetch("/api/shopify/inventory/load-stock", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ productSyncId: loadStockSync.id, quantity: qty }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                setLoadStockError(typeof data.message === "string" ? data.message : "Could not load stock.")
                return
            }
            toast.success(typeof data.message === "string" ? data.message : "Stock loaded.")
            setShowLoadStockModal(false)
            setLoadStockProduct(null)
            setLoadStockSync(null)
            await refetchInventoryAndSyncs()
        } catch {
            setLoadStockError("Could not load stock.")
        } finally {
            setLoadStockSubmitting(false)
        }
    }

    const handleSyncProduct = (product: ShopifyProduct) => {
        if (connectedSuppliers.length === 0) {
            toast.error("You need to connect with at least one supplier before syncing products. Please go to Suppliers > My Suppliers to connect.")
            return
        }
        setSelectedProduct(product)
        setShowSupplierModal(true)
    }

    const handleSelectSupplier = async (supplierId: string) => {
        if (!selectedProduct) return

        setSyncingProduct(true)
        try {
            const res = await fetch("/api/products/sync", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    shopifyProductId: selectedProduct.id,
                    shopifyProductTitle: selectedProduct.title,
                    shopifyProductData: selectedProduct,
                    supplierId
                })
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.message || "Failed to send sync request")
            }

            // Refresh syncs
            const syncRes = await fetch("/api/products/sync")
            if (syncRes.ok) {
                const syncData = await syncRes.json()
                const syncsMap = new Map<string, ProductSync>()
                syncData.syncs?.forEach((sync: ProductSync) => {
                    syncsMap.set(sync.shopifyProductId, sync)
                })
                setProductSyncs(syncsMap)
            }

            // Automatically close modal and reset state
            setShowSupplierModal(false)
            setSelectedProduct(null)
            toast.success("Product sync request sent successfully! The supplier will be notified.")
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Failed to send sync request"
            toast.error(errorMessage)
        } finally {
            setSyncingProduct(false)
        }
    }

    const handleExport = () => {
        const csvHeaders = ["ID", "Title", "Vendor", "Status", "Variants", "Created At"]
        const csvRows = filteredProducts.map(p => [
            p.id,
            `"${p.title.replace(/"/g, '""')}"`,
            p.vendor,
            p.status,
            p.variants.length,
            new Date(p.created_at).toLocaleDateString()
        ])

        const csvContent = [
            csvHeaders.join(","),
            ...csvRows.map(row => row.join(","))
        ].join("\n")

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
        const link = document.createElement("a")
        const url = URL.createObjectURL(blob)
        link.setAttribute("href", url)
        link.setAttribute("download", `inventory-${new Date().toISOString().split("T")[0]}.csv`)
        link.style.visibility = "hidden"
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        toast.success("Inventory exported successfully")
    }

    const filteredProducts = products.filter(p => {
        const matchesSearch = p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.vendor.toLowerCase().includes(searchTerm.toLowerCase())
        const matchesStatus = statusFilter === "all" || p.status === statusFilter
        const matchesVendor = vendorFilter === "all" || p.vendor.toLowerCase() === vendorFilter.toLowerCase()
        return matchesSearch && matchesStatus && matchesVendor
    })

    const uniqueVendors = Array.from(new Set(products.map(p => p.vendor))).sort()

    return (
        <>
            <div className="flex flex-col h-full min-h-0 space-y-4 md:space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 flex-shrink-0">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">Inventory</h1>
                        <p className="text-sm md:text-base text-slate-400 mt-1">Manage your synced Shopify products and variants.</p>
                    </div>
                    <div className="flex gap-2 md:gap-3">
                        <button
                            onClick={handleExport}
                            className="h-10 md:h-11 px-3 md:px-4 bg-white/10 border border-white/10 rounded-xl font-bold text-white hover:bg-white/15 backdrop-blur-sm transition-all flex items-center gap-2 text-sm"
                        >
                            <Download className="w-4 h-4" /> <span className="hidden sm:inline">Export</span>
                        </button>
                    </div>
                </div>

                <div className="bg-white/5 backdrop-blur-xl rounded-xl md:rounded-2xl border border-white/10 flex flex-col flex-1 min-h-0 relative overflow-hidden">
                    <div className="p-4 md:p-6 border-b border-white/10 flex flex-col sm:flex-row gap-3 md:gap-4 justify-between bg-white/5 flex-shrink-0">
                        <div className="relative flex-1 min-w-0">
                            <Search className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <input
                                type="text"
                                placeholder="Search products, vendors..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full h-10 md:h-11 pl-10 md:pl-11 pr-4 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 text-white placeholder:text-slate-500 text-sm font-medium transition-all"
                            />
                        </div>
                        <div className="relative">
                            <button
                                onClick={() => setShowFilters(!showFilters)}
                                className={`h-10 md:h-11 px-4 bg-white/10 border border-white/10 rounded-xl font-bold text-slate-300 hover:bg-white/15 transition-all flex items-center justify-center gap-2 text-sm shrink-0 ${showFilters ? "bg-indigo-500/20 border-indigo-500/30 text-indigo-400" : ""}`}
                            >
                                <Filter className="w-4 h-4" /> Filters
                            </button>
                            {showFilters && (
                                <div className="absolute right-0 top-full mt-2 bg-slate-900 border border-white/10 rounded-xl shadow-xl p-4 z-50 min-w-[200px] max-w-[calc(100vw-2rem)]">
                                    <div className="space-y-3">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-400 mb-2">Status</label>
                                            <select
                                                value={statusFilter}
                                                onChange={(e) => {
                                                    setStatusFilter(e.target.value)
                                                }}
                                                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                                            >
                                                <option value="all">All Statuses</option>
                                                <option value="active">Active</option>
                                                <option value="archived">Archived</option>
                                                <option value="draft">Draft</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-400 mb-2">Vendor</label>
                                            <select
                                                value={vendorFilter}
                                                onChange={(e) => {
                                                    setVendorFilter(e.target.value)
                                                }}
                                                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                                            >
                                                <option value="all">All Vendors</option>
                                                {uniqueVendors.map(vendor => (
                                                    <option key={vendor} value={vendor}>{vendor}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <button
                                            onClick={() => {
                                                setStatusFilter("all")
                                                setVendorFilter("all")
                                            }}
                                            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm hover:bg-white/10 transition-colors"
                                        >
                                            Clear Filters
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto overflow-x-auto -mx-4 md:mx-0 min-h-0">
                        <div className="min-w-full px-4 md:px-0">
                            {loading ? (
                                <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-3">
                                    <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
                                    <p className="font-medium animate-pulse">Syncing with Shopify...</p>
                                </div>
                            ) : error ? (
                                <div className="h-64 flex flex-col items-center justify-center text-red-400 gap-4 p-8 text-center">
                                    <div className="w-12 h-12 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center">
                                        <AlertCircle className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <p className="font-bold">{error}</p>
                                        <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">Check your Shopify API permissions (read_products) and try again.</p>
                                    </div>
                                </div>
                            ) : filteredProducts.length === 0 ? (
                                <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-3">
                                    <Package className="w-10 h-10 opacity-20" />
                                    <p className="font-medium">No products found.</p>
                                </div>
                            ) : (
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-white/5 border-b border-white/10">
                                            <th className="px-4 md:px-8 py-3 md:py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest min-w-[200px] md:min-w-[300px]">Product</th>
                                            <th className="px-3 md:px-6 py-3 md:py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Status</th>
                                            <th className="px-3 md:px-6 py-3 md:py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap text-left">
                                                Shopify stock
                                            </th>
                                            <th className="px-3 md:px-6 py-3 md:py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap text-left">
                                                Supplier stock
                                            </th>
                                            <th className="px-3 md:px-6 py-3 md:py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap hidden md:table-cell text-left">Supplier</th>
                                            <th className="px-3 md:px-6 py-3 md:py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap hidden lg:table-cell text-left">Sync</th>
                                            <th className="px-4 md:px-8 py-3 md:py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {filteredProducts.map((product) => (
                                            <tr key={product.id} className="hover:bg-white/5 transition-colors group">
                                                <td className="px-4 md:px-8 py-3 md:py-4">
                                                    <div className="flex items-center gap-3 md:gap-4">
                                                        <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg md:rounded-xl bg-white/10 border border-white/10 overflow-hidden shrink-0 flex items-center justify-center">
                                                            {product.image?.src ? (
                                                                <Image src={product.image.src} alt="" width={48} height={48} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <ImageIcon className="w-4 h-4 md:w-5 md:h-5 text-slate-500" />
                                                            )}
                                                        </div>
                                                        <div className="flex flex-col min-w-0">
                                                            <span className="font-bold text-sm md:text-base text-white group-hover:text-indigo-400 transition-colors truncate">{product.title}</span>
                                                            <span className="text-[10px] font-medium text-slate-500 font-mono tracking-tighter">ID: {product.id}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-3 md:px-6 py-3 md:py-4">
                                                    <span className={`px-2 md:px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${product.status === "active"
                                                        ? "bg-emerald-500/20 text-emerald-400"
                                                        : "bg-white/10 text-slate-500"
                                                        }`}>
                                                        {product.status}
                                                    </span>
                                                </td>
                                                <td className="px-3 md:px-6 py-3 md:py-4">
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className="font-bold text-sm md:text-base text-white tabular-nums">
                                                            {totalShopifyInventory(product.variants)}
                                                        </span>
                                                        <span className="text-[10px] text-slate-500">
                                                            {product.variants.length} variant
                                                            {product.variants.length !== 1 ? "s" : ""}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-3 md:px-6 py-3 md:py-4">
                                                    {(() => {
                                                        const sync = getProductSyncStatus(product.id)
                                                        if (!sync || sync.status !== "ACCEPTED") {
                                                            return (
                                                                <span className="text-sm text-slate-500">—</span>
                                                            )
                                                        }
                                                        const q = sync.supplierAvailableQuantity
                                                        return (
                                                            <span className="font-bold text-sm md:text-base text-white tabular-nums">
                                                                {q != null ? String(q) : "—"}
                                                            </span>
                                                        )
                                                    })()}
                                                </td>
                                                <td className="px-3 md:px-6 py-3 md:py-4 hidden md:table-cell text-left">
                                                    {(() => {
                                                        const sync = isProductSynced(product.id)
                                                        const syncStatus = getProductSyncStatus(product.id)
                                                        return sync ? (
                                                            <span className="text-sm font-medium text-white">{sync.supplier.companyName}</span>
                                                        ) : syncStatus?.status === "PENDING" ? (
                                                            <span className="text-sm font-medium text-yellow-400">Pending...</span>
                                                        ) : (
                                                            <span className="text-sm font-medium text-slate-500">—</span>
                                                        )
                                                    })()}
                                                </td>
                                                <td className="px-3 md:px-6 py-3 md:py-4 hidden lg:table-cell text-left">
                                                    {(() => {
                                                        const sync = isProductSynced(product.id)
                                                        const syncStatus = getProductSyncStatus(product.id)
                                                        return sync ? (
                                                            <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400">
                                                                Synced
                                                            </span>
                                                        ) : syncStatus?.status === "PENDING" ? (
                                                            <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-yellow-500/20 text-yellow-400">
                                                                Pending
                                                            </span>
                                                        ) : (
                                                            <button
                                                                onClick={() => handleSyncProduct(product)}
                                                                className="inline-block px-3 py-1.5 bg-indigo-500/20 text-indigo-400 border border-indigo-400/30 rounded-lg text-xs font-bold hover:bg-indigo-500/30 transition-colors"
                                                            >
                                                                Sync
                                                            </button>
                                                        )
                                                    })()}
                                                </td>
                                                <td className="px-4 md:px-8 py-3 md:py-4 text-right">
                                                    <div className="relative">
                                                        <button
                                                            ref={(el) => { menuRefs.current[product.id] = el }}
                                                            onClick={(e) => handleMenuToggle(product.id, e)}
                                                            className={`p-2 rounded-lg transition-all relative z-10 ${openMenuId === product.id
                                                                ? (isLight ? "bg-indigo-100 text-indigo-600" : "bg-white/10 text-indigo-400")
                                                                : (isLight ? "text-slate-400 hover:text-slate-600 hover:bg-slate-100" : "text-slate-400 hover:text-indigo-400 hover:bg-white/10")
                                                                }`}
                                                        >
                                                            <MoreHorizontal className="w-4 h-4 md:w-5 md:h-5" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>

                    {/* Pagination removed as per requirements */}
                </div>

                {/* Supplier Selection Modal */}
                {showLoadStockModal && loadStockProduct && loadStockSync && (
                    <div className={`fixed inset-0 backdrop-blur-sm z-50 flex items-center justify-center p-4 ${isLight ? "bg-black/40" : "bg-black/60"}`}>
                        <div className={`rounded-2xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col ${isLight ? "bg-white border border-slate-200" : "bg-slate-900 border border-white/10"}`}>
                            <div className={`p-6 flex items-center justify-between ${isLight ? "border-b border-slate-200" : "border-b border-white/10"}`}>
                                <div>
                                    <h2 className={`text-xl font-bold ${isLight ? "text-slate-900" : "text-white"}`}>Load stock</h2>
                                    <p className={`text-sm mt-1 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                                        Add inventory to Shopify from supplier stock for &quot;{loadStockProduct.title}&quot;
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (!loadStockSubmitting) {
                                            setShowLoadStockModal(false)
                                            setLoadStockProduct(null)
                                            setLoadStockSync(null)
                                        }
                                    }}
                                    className={`p-2 rounded-lg transition-colors ${isLight ? "text-slate-500 hover:text-slate-900 hover:bg-slate-100" : "text-slate-400 hover:text-white hover:bg-white/10"}`}
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="p-6 space-y-4">
                                <p className={`text-xs ${isLight ? "text-slate-500" : "text-slate-500"}`}>
                                    Sellable quantity is added to the <span className="font-semibold">first variant</span> at your primary Shopify location. Supplier stock cannot exceed what is shown below.
                                </p>
                                <div className={`grid grid-cols-2 gap-3 text-sm ${isLight ? "text-slate-700" : "text-slate-300"}`}>
                                    <div>
                                        <span className={`block text-[10px] uppercase font-bold ${isLight ? "text-slate-400" : "text-slate-500"}`}>Supplier stock</span>
                                        <span className={`font-mono font-bold tabular-nums text-base ${isLight ? "text-slate-900" : "text-white"}`}>
                                            {loadStockSync.supplierAvailableQuantity ?? "—"}
                                        </span>
                                    </div>
                                    <div>
                                        <span className={`block text-[10px] uppercase font-bold ${isLight ? "text-slate-400" : "text-slate-500"}`}>Shopify (total)</span>
                                        <span className={`font-mono font-bold tabular-nums text-base ${isLight ? "text-slate-900" : "text-white"}`}>
                                            {totalShopifyInventory(loadStockProduct.variants)}
                                        </span>
                                    </div>
                                </div>
                                <div>
                                    <label htmlFor="load-stock-qty" className={`block text-xs font-bold uppercase tracking-widest mb-2 ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                                        Quantity to load
                                    </label>
                                    <input
                                        id="load-stock-qty"
                                        type="number"
                                        min={1}
                                        max={loadStockSync.supplierAvailableQuantity ?? undefined}
                                        value={loadStockQtyInput}
                                        onChange={(e) => setLoadStockQtyInput(e.target.value)}
                                        disabled={loadStockSubmitting}
                                        className={`w-full h-11 rounded-xl px-3 font-mono tabular-nums border outline-none focus:ring-2 ${isLight
                                            ? "bg-slate-50 border-slate-200 text-slate-900 focus:ring-indigo-500/30"
                                            : "bg-white/5 border-white/10 text-white focus:ring-indigo-500/30"
                                            }`}
                                    />
                                </div>
                                {loadStockError ? (
                                    <p className="text-sm text-red-400">{loadStockError}</p>
                                ) : null}
                                <button
                                    type="button"
                                    disabled={loadStockSubmitting}
                                    onClick={() => void handleSubmitLoadStock()}
                                    className="w-full h-11 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm transition-colors flex items-center justify-center gap-2"
                                >
                                    {loadStockSubmitting ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Loading…
                                        </>
                                    ) : (
                                        "Load"
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {showSupplierModal && selectedProduct && (
                    <div className={`fixed inset-0 backdrop-blur-sm z-50 flex items-center justify-center p-4 ${isLight ? "bg-black/40" : "bg-black/60"}`}>
                        <div className={`rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col ${isLight ? "bg-white border border-slate-200" : "bg-slate-900 border border-white/10"}`}>
                            <div className={`p-6 flex items-center justify-between ${isLight ? "border-b border-slate-200" : "border-b border-white/10"}`}>
                                <div>
                                    <h2 className={`text-2xl font-bold ${isLight ? "text-slate-900" : "text-white"}`}>Select Supplier</h2>
                                    <p className={`text-sm mt-1 ${isLight ? "text-slate-600" : "text-slate-400"}`}>Choose a supplier to sync &quot;{selectedProduct.title}&quot;</p>
                                </div>
                                <button
                                    onClick={() => {
                                        setShowSupplierModal(false)
                                        setSelectedProduct(null)
                                    }}
                                    className={`p-2 rounded-lg transition-colors ${isLight ? "text-slate-500 hover:text-slate-900 hover:bg-slate-100" : "text-slate-400 hover:text-white hover:bg-white/10"}`}
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-6">
                                {connectedSuppliers.length === 0 ? (
                                    <div className="text-center py-12">
                                        <AlertCircle className={`w-12 h-12 mx-auto mb-4 ${isLight ? "text-slate-400" : "text-slate-500"}`} />
                                        <p className={`font-medium ${isLight ? "text-slate-700" : "text-slate-400"}`}>No connected suppliers</p>
                                        <p className={`text-sm mt-2 ${isLight ? "text-slate-500" : "text-slate-500"}`}>Please connect with suppliers first from the Suppliers page.</p>
                                    </div>
                                ) : (
                                    <div className="grid gap-3">
                                        {connectedSuppliers.map((supplier) => (
                                            <button
                                                key={supplier.id}
                                                onClick={() => handleSelectSupplier(supplier.id)}
                                                disabled={syncingProduct}
                                                className={`p-4 rounded-xl transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed group ${isLight
                                                    ? "bg-slate-50 border border-slate-200 hover:bg-slate-100 hover:border-indigo-300"
                                                    : "bg-white/5 border border-white/10 hover:bg-white/10 hover:border-indigo-500/50"
                                                    }`}
                                            >
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1">
                                                        <h3 className={`font-bold ${isLight ? "text-slate-900" : "text-white"}`}>{supplier.companyName}</h3>
                                                        {supplier.description && (
                                                            <p className={`text-sm mt-1 line-clamp-2 ${isLight ? "text-slate-600" : "text-slate-400"}`}>{supplier.description}</p>
                                                        )}
                                                        <p className={`text-xs mt-2 ${isLight ? "text-slate-500" : "text-slate-500"}`}>{supplier.user.email}</p>
                                                    </div>
                                                    {syncingProduct ? (
                                                        <Loader2 className="w-5 h-5 animate-spin text-indigo-400 ml-4" />
                                                    ) : (
                                                        <CheckCircle2 className="w-5 h-5 text-indigo-400 ml-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                    )}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {mounted && createPortal(
                <AnimatePresence>
                    {openMenuId !== null && menuRect !== null && (
                        <>
                            <div
                                className="fixed inset-0 z-[100]"
                                onClick={() => {
                                    setOpenMenuId(null)
                                    setMenuRect(null)
                                }}
                            />
                            <ActionsMenuContent
                                openMenuId={openMenuId}
                                menuRect={menuRect}
                                isLight={isLight}
                                products={products}
                                storeDomain={storeDomain}
                                handleViewProduct={handleViewProduct}
                                handleCopyProductId={handleCopyProductId}
                                handleRefreshProduct={handleRefreshProduct}
                                loadStockEnabled={(() => {
                                    const p = products.find((x) => x.id === openMenuId)
                                    if (!p) return false
                                    const s = getProductSyncStatus(p.id)
                                    const cap = s?.supplierAvailableQuantity
                                    return (
                                        !!s &&
                                        s.status === "ACCEPTED" &&
                                        cap != null &&
                                        cap > 0
                                    )
                                })()}
                                onLoadStock={() => {
                                    const p = products.find((x) => x.id === openMenuId)
                                    if (!p) return
                                    const s = getProductSyncStatus(p.id)
                                    if (!s || s.status !== "ACCEPTED") return
                                    const cap = s.supplierAvailableQuantity
                                    if (cap == null || cap <= 0) return
                                    handleOpenLoadStock(p, s)
                                }}
                                onClose={() => {
                                    setOpenMenuId(null)
                                    setMenuRect(null)
                                }}
                            />
                        </>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </>
    )
}

function ActionsMenuContent({
    openMenuId,
    menuRect,
    isLight,
    products,
    storeDomain,
    handleViewProduct,
    handleCopyProductId,
    handleRefreshProduct,
    loadStockEnabled,
    onLoadStock,
    onClose
}: {
    openMenuId: number;
    menuRect: { top: number; left: number };
    isLight: boolean;
    products: ShopifyProduct[];
    storeDomain: string | null;
    handleViewProduct: (product: ShopifyProduct) => void;
    handleCopyProductId: (productId: number) => void;
    handleRefreshProduct: () => void;
    loadStockEnabled: boolean;
    onLoadStock: () => void;
    onClose: () => void;
}) {
    const product = products.find(p => p.id === openMenuId);
    if (!product) return null;

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            key="inventory-actions-menu"
            style={{
                position: 'absolute',
                top: menuRect.top + 4,
                left: menuRect.left - 180,
                zIndex: 101,
                width: 180
            }}
            className={`rounded-xl shadow-2xl border overflow-hidden ${isLight
                ? "bg-white border-slate-200"
                : "bg-slate-900 border-white/10"
                }`}
        >
            <div className="flex flex-col">
                <button
                    onClick={() => handleViewProduct(product)}
                    className={`w-full px-4 py-2.5 text-left text-sm font-medium flex items-center gap-2 transition-colors ${isLight
                        ? "text-slate-700 hover:bg-slate-50 hover:text-indigo-600"
                        : "text-slate-300 hover:bg-white/5 hover:text-white"
                        }`}
                >
                    <Eye className="w-4 h-4" />
                    View in Shopify
                </button>
                <button
                    onClick={() => handleCopyProductId(openMenuId)}
                    className={`w-full px-4 py-2.5 text-left text-sm font-medium flex items-center gap-2 transition-colors ${isLight
                        ? "text-slate-700 hover:bg-slate-50 hover:text-indigo-600"
                        : "text-slate-300 hover:bg-white/5 hover:text-white"
                        }`}
                >
                    <Copy className="w-4 h-4" />
                    Copy Product ID
                </button>
                <button
                    onClick={() => handleRefreshProduct()}
                    className={`w-full px-4 py-2.5 text-left text-sm font-medium flex items-center gap-2 transition-colors ${isLight
                        ? "text-slate-700 hover:bg-slate-50 hover:text-indigo-600"
                        : "text-slate-300 hover:bg-white/5 hover:text-white"
                        }`}
                >
                    <RefreshCw className="w-4 h-4" />
                    Refresh Product
                </button>
                <button
                    type="button"
                    disabled={!loadStockEnabled}
                    title={!loadStockEnabled ? "Requires accepted sync with supplier stock" : undefined}
                    onClick={() => {
                        if (!loadStockEnabled) return
                        onLoadStock()
                    }}
                    className={`w-full px-4 py-2.5 text-left text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${isLight
                        ? "text-slate-700 hover:bg-slate-50 hover:text-indigo-600"
                        : "text-slate-300 hover:bg-white/5 hover:text-white"
                        }`}
                >
                    <PackagePlus className="w-4 h-4" />
                    Load stock
                </button>

                {storeDomain && product.handle && (
                    <>
                        <div className={`border-t ${isLight ? "border-slate-100" : "border-white/5"}`} />
                        <a
                            href={`https://${storeDomain}/products/${product.handle}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={onClose}
                            className={`w-full px-4 py-2.5 text-left text-sm font-medium flex items-center gap-2 transition-colors ${isLight
                                ? "text-slate-700 hover:bg-slate-50 hover:text-indigo-600"
                                : "text-slate-300 hover:bg-white/5 hover:text-white"
                                }`}
                        >
                            <ExternalLink className="w-4 h-4" />
                            View on Storefront
                        </a>
                    </>
                )}
            </div>
        </motion.div>
    );
}
