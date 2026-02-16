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

    useEffect(() => {
        fetchSyncedProducts()
    }, [])

    const fetchSyncedProducts = async () => {
        try {
            setLoading(true)
            const res = await fetch("/api/vendors/synced-products")
            if (!res.ok) throw new Error("Failed to fetch synced products")
            const data = await res.json()
            setProducts(data.products || [])
            setError("")
        } catch {
            setError("Failed to load synced products")
        } finally {
            setLoading(false)
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                        {products.map((product) => (
                            <button
                                key={product.id}
                                type="button"
                                onClick={() => openProductDetail(product)}
                                className="bg-white/5 backdrop-blur-xl rounded-xl md:rounded-2xl border border-white/10 overflow-hidden hover:border-indigo-500/50 transition-colors group text-left"
                            >
                                <div className="relative w-full h-48 bg-white/10 overflow-hidden">
                                    {product.imageUrl ? (
                                        <Image
                                            src={product.imageUrl}
                                            alt={product.title}
                                            fill
                                            className="object-cover group-hover:scale-105 transition-transform"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <ImageIcon className="w-12 h-12 text-slate-500" />
                                        </div>
                                    )}
                                    <div className="absolute top-2 right-2 flex gap-2">
                                        <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-xs font-bold uppercase">
                                            {product.source === "supplier_offer" ? "From Supplier" : "Synced"}
                                        </span>
                                    </div>
                                </div>
                                <div className="p-4 md:p-6">
                                    <h3 className="font-bold text-white text-lg mb-2 line-clamp-2 group-hover:text-indigo-400 transition-colors">
                                        {product.title}
                                    </h3>
                                    
                                    {product.description && (
                                        <p className="text-sm text-slate-400 mb-3 line-clamp-2">
                                            {product.description.replace(/<[^>]*>/g, "")}
                                        </p>
                                    )}

                                    <div className="flex items-center justify-between mb-3">
                                        <div>
                                            <p className="text-2xl font-bold text-white">
                                                ${parseFloat(product.price).toFixed(2)}
                                            </p>
                                            {product.sku && (
                                                <p className="text-xs text-slate-500 font-mono">SKU: {product.sku}</p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="pt-3 border-t border-white/10 space-y-2">
                                        <div className="flex items-center gap-2 text-sm text-slate-400">
                                            <Building2 className="w-4 h-4" />
                                            <span className="truncate">{product.supplier.companyName}</span>
                                        </div>
                                        <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                                            <div className="flex items-center gap-2">
                                                <Calendar className="w-3 h-3" />
                                                <span>
                                                    {product.source === "supplier_offer"
                                                        ? `Provided ${new Date(product.syncedAt).toLocaleDateString()}`
                                                        : `Synced ${new Date(product.syncedAt).toLocaleDateString()}`}
                                                </span>
                                            </div>
                                            {product.source === "supplier_offer" && product.offerQuantity !== undefined && (
                                                <span className="flex items-center gap-1">
                                                    <Info className="w-3 h-3" />
                                                    Qty: {product.offerQuantity}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {selectedProduct && (
                <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-white/10 rounded-2xl shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
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
                                        {selectedProduct.source === "supplier_offer" &&
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
