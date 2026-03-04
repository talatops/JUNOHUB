"use client"

import { useEffect, useState } from "react"
import {
    Package,
    Loader2,
    AlertCircle,
    Image as ImageIcon,
    Eye,
    Building2,
    Calendar,
    X,
    Info
} from "lucide-react"
import Image from "next/image"
import { useTheme } from "@/components/ThemeProvider"
import { cn } from "@/lib/utils"

interface SyncedProduct {
    id: string
    syncId: string | null
    shopifyProductId: string | null
    title: string
    description: string | null
    price: string
    sku: string | null
    imageUrl: string | null
    supplier: {
        id: string
        companyName: string
    }
    syncedAt: string
    isSynced: boolean
    source?: "synced" | "supplier_offer"
    shopifyData?: any
    offerQuantity?: number
    offerId?: string
}

export default function NewProductsPage() {
    const [products, setProducts] = useState<SyncedProduct[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState("")
    const [selectedProduct, setSelectedProduct] = useState<SyncedProduct | null>(null)
    const [detailLoading, setDetailLoading] = useState(false)
    const [detailError, setDetailError] = useState("")
    const { theme } = useTheme()
    const isLight = theme === "light"
    const [refreshing, setRefreshing] = useState(false)

    useEffect(() => {
        // Initial load with full-page skeleton
        fetchSyncedProducts(false)

        // Periodically refresh in the background without resetting layout
        const interval = setInterval(() => {
            fetchSyncedProducts(true)
        }, 10000) // every 10 seconds

        // Also refresh when the tab becomes visible again, silently
        const handleVisibilityChange = () => {
            if (!document.hidden) {
                fetchSyncedProducts(true)
            }
        }

        document.addEventListener("visibilitychange", handleVisibilityChange)

        return () => {
            clearInterval(interval)
            document.removeEventListener("visibilitychange", handleVisibilityChange)
        }
    }, [])

    const fetchSyncedProducts = async (silent: boolean) => {
        try {
            if (silent) {
                setRefreshing(true)
            } else {
                setLoading(true)
            }
            const res = await fetch("/api/vendors/synced-products")
            if (!res.ok) throw new Error("Failed to fetch synced products")
            const data = await res.json()
            const nextProducts: SyncedProduct[] = data.products || []

            // Avoid unnecessary re-renders (which can cause subtle flicker)
            setProducts((prev) => {
                if (prev.length === nextProducts.length) {
                    const same = prev.every((p, idx) => {
                        const n = nextProducts[idx]
                        return (
                            p.id === n.id &&
                            p.price === n.price &&
                            p.sku === n.sku &&
                            p.imageUrl === n.imageUrl &&
                            p.syncedAt === n.syncedAt &&
                            p.source === n.source &&
                            p.offerQuantity === n.offerQuantity
                        )
                    })
                    if (same) return prev
                }
                return nextProducts
            })
            setError("")
        } catch {
            setError("Failed to load synced products")
        } finally {
            if (silent) {
                setRefreshing(false)
            } else {
                setLoading(false)
            }
        }
    }

    const openProductDetail = async (product: SyncedProduct) => {
        setSelectedProduct(null)
        setDetailError("")
        setDetailLoading(true)
        try {
            const res = await fetch(`/api/vendors/synced-products/${product.id}`)
            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                throw new Error(data.message || "Failed to load product")
            }
            const data = await res.json()
            setSelectedProduct(data.product || product)
        } catch (err) {
            setDetailError(err instanceof Error ? err.message : "Failed to load product")
            setSelectedProduct(product)
        } finally {
            setDetailLoading(false)
        }
    }

    return (
        <div className="h-full flex flex-col space-y-4 md:space-y-6">
            <div className="flex-shrink-0">
                <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">New Products</h1>
                <p className="text-sm md:text-base text-slate-400 mt-1">
                    Products available from your connected suppliers
                </p>
            </div>

            {error && (
                <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-4 flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-red-400" />
                    <span className="text-sm text-red-400 font-medium">{error}</span>
                </div>
            )}

            <div className="flex-1 overflow-y-auto">
                {loading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="bg-white/5 backdrop-blur-xl p-4 md:p-6 rounded-xl md:rounded-2xl border border-white/10 animate-pulse">
                                <div className="h-32 md:h-40 bg-white/10 rounded-xl mb-3 md:mb-4" />
                                <div className="h-4 w-2/3 bg-white/10 rounded mb-2" />
                                <div className="h-4 w-1/3 bg-white/10 rounded" />
                            </div>
                        ))}
                    </div>
                ) : products.length === 0 ? (
                    <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-3">
                        <Package className="w-12 h-12 opacity-20" />
                        <p className="font-medium">No synced products yet</p>
                        <p className="text-sm text-slate-500">Sync products with suppliers from the Inventory page</p>
                    </div>
                ) : (
                    <div className="bg-white/5 backdrop-blur-xl rounded-xl border border-white/10 overflow-hidden">
                        <div className="divide-y divide-white/10">
                            {products.map((product) => (
                                <button
                                    key={product.id}
                                    type="button"
                                    onClick={() => openProductDetail(product)}
                                    className="w-full flex items-center gap-4 px-4 md:px-6 py-3 md:py-4 hover:bg-white/5 text-left transition-colors"
                                >
                                    <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-white/10 flex-shrink-0">
                                        {product.imageUrl ? (
                                            <Image
                                                src={product.imageUrl}
                                                alt={product.title}
                                                fill
                                                className="object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <ImageIcon className="w-7 h-7 text-slate-500" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0 space-y-1">
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-semibold text-white truncate">
                                                {product.title}
                                            </h3>
                                            <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full text-[10px] font-bold uppercase whitespace-nowrap">
                                                {product.source === "supplier_offer" ? "From Supplier" : "Synced"}
                                            </span>
                                        </div>
                                        {product.description && (
                                            <p className="text-xs text-slate-400 line-clamp-2">
                                                {product.description.replace(/<[^>]*>/g, "")}
                                            </p>
                                        )}
                                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                                            <span className="flex items-center gap-1">
                                                <Building2 className="w-3 h-3" />
                                                <span className="truncate max-w-[160px]">
                                                    {product.supplier.companyName}
                                                </span>
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Calendar className="w-3 h-3" />
                                                <span>
                                                    {product.source === "supplier_offer"
                                                        ? `Provided ${new Date(product.syncedAt).toLocaleDateString()}`
                                                        : `Synced ${new Date(product.syncedAt).toLocaleDateString()}`}
                                                </span>
                                            </span>
                                            {(product.source === "supplier_offer" ||
                                                product.source === "synced") &&
                                                product.offerQuantity !== undefined && (
                                                    <span className="flex items-center gap-1">
                                                        <Info className="w-3 h-3" />
                                                        Qty: {product.offerQuantity}
                                                    </span>
                                                )}
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        <p className="text-xs text-slate-500 uppercase tracking-wide">
                                            Price
                                        </p>
                                        <p className="text-lg font-bold text-white">
                                            ${parseFloat(product.price).toFixed(2)}
                                        </p>
                                        {product.sku && (
                                            <p className="text-[11px] text-slate-500 font-mono">
                                                SKU: {product.sku}
                                            </p>
                                        )}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {selectedProduct && (
                <div
                    className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm"
                    onClick={() => {
                        setSelectedProduct(null)
                        setDetailError("")
                    }}
                >
                    <div
                        className={cn(
                            "rounded-2xl shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col border transition-colors",
                            isLight
                                ? "bg-white border-slate-200"
                                : "bg-slate-900 border-white/10"
                        )}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                            <div className="flex items-center gap-2">
                                <Package className="w-5 h-5 text-indigo-400" />
                                <div>
                                    <h2 className="text-lg font-bold text-white">{selectedProduct.title}</h2>
                                    <p className="text-xs text-slate-500">
                                        {selectedProduct.source === "supplier_offer"
                                            ? "Provided by supplier"
                                            : "Synced product"}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setSelectedProduct(null)
                                    setDetailError("")
                                }}
                                className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                            {detailLoading && (
                                <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Loading latest details...
                                </div>
                            )}
                            {detailError && (
                                <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-3 flex items-center gap-2 text-sm text-red-300">
                                    <AlertCircle className="w-4 h-4" />
                                    <span>{detailError}</span>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="relative w-full h-56 bg-white/10 rounded-xl overflow-hidden">
                                    {selectedProduct.imageUrl ? (
                                        <Image
                                            src={selectedProduct.imageUrl}
                                            alt={selectedProduct.title}
                                            fill
                                            className="object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-slate-500">
                                            <ImageIcon className="w-10 h-10" />
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-3 text-sm text-slate-300">
                                    <div>
                                        <p className="text-xs text-slate-500 uppercase tracking-wide">
                                            Price
                                        </p>
                                        <p className="text-2xl font-bold text-white">
                                            ${parseFloat(selectedProduct.price).toFixed(2)}
                                        </p>
                                        {(selectedProduct.source === "supplier_offer" ||
                                            selectedProduct.source === "synced") &&
                                            selectedProduct.offerQuantity !== undefined && (
                                                <p className="mt-1 text-xs text-slate-500">
                                                    Quantity available from supplier:{" "}
                                                    {selectedProduct.offerQuantity}
                                                </p>
                                            )}
                                    </div>
                                    {selectedProduct.sku && (
                                        <div>
                                            <p className="text-xs text-slate-500 uppercase tracking-wide">
                                                SKU
                                            </p>
                                            <p className="font-mono text-xs text-slate-200">
                                                {selectedProduct.sku}
                                            </p>
                                        </div>
                                    )}
                                    <div>
                                        <p className="text-xs text-slate-500 uppercase tracking-wide">
                                            Supplier
                                        </p>
                                        <p className="text-sm text-slate-200">
                                            {selectedProduct.supplier.companyName}
                                        </p>
                                    </div>
                                    <div className="text-xs text-slate-500">
                                        {selectedProduct.source === "supplier_offer"
                                            ? `Provided on ${new Date(
                                                  selectedProduct.syncedAt
                                              ).toLocaleString()}`
                                            : `Synced on ${new Date(
                                                  selectedProduct.syncedAt
                                              ).toLocaleString()}`}
                                    </div>
                                </div>
                            </div>

                            {selectedProduct.description && (
                                <div className="mt-2 text-sm text-slate-300 space-y-1">
                                    <p className="text-xs text-slate-500 uppercase tracking-wide">
                                        Description
                                    </p>
                                    <p>
                                        {selectedProduct.description.replace(/<[^>]*>/g, "")}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
