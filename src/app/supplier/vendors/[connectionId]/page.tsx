"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import {
    ArrowLeft,
    Building2,
    Globe,
    Mail,
    Loader2,
    AlertCircle,
    Package,
    Plus,
    Edit,
    Trash2
} from "lucide-react"
import Image from "next/image"

interface StoreSummary {
    id: string
    businessName: string
    shopifyDomain: string | null
    shopifyStoreName: string | null
    email?: string | null
    user: {
        name: string | null
        email: string | null
    }
}

interface ConnectionDetail {
    id: string
    status: "PENDING" | "CONNECTED" | "REJECTED"
    createdAt: string
    store: StoreSummary
}

interface Product {
    id: string
    title: string
    description: string | null
    price: number
    sku: string | null
    imageUrl: string | null
}

interface Offer {
    id: string
    price: number
    quantity: number
    createdAt: string
    product: Product
    store: {
        id: string
        businessName: string
    }
}

interface SupplierProduct {
    id: string
    title: string
    description: string | null
    price: number
    sku: string | null
    imageUrl: string | null
    isSynced?: boolean
}

export default function SupplierVendorDetailPage() {
    const params = useParams<{ connectionId: string }>()
    const router = useRouter()

    const [connection, setConnection] = useState<ConnectionDetail | null>(null)
    const [offers, setOffers] = useState<Offer[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState("")
    const [success, setSuccess] = useState("")

    const [showProvideModal, setShowProvideModal] = useState(false)
    const [products, setProducts] = useState<SupplierProduct[]>([])
    const [productsLoading, setProductsLoading] = useState(false)
    const [selectedProductId, setSelectedProductId] = useState<string>("")
    const [priceInput, setPriceInput] = useState<string>("")
    const [quantityInput, setQuantityInput] = useState<string>("")
    const [submittingOffer, setSubmittingOffer] = useState(false)

    const connectionId = params?.connectionId

    useEffect(() => {
        if (!connectionId) return
        fetchData()
    }, [connectionId])

    useEffect(() => {
        if (success) {
            const timer = setTimeout(() => setSuccess(""), 5000)
            return () => clearTimeout(timer)
        }
    }, [success])

    useEffect(() => {
        if (error) {
            const timer = setTimeout(() => setError(""), 5000)
            return () => clearTimeout(timer)
        }
    }, [error])

    const fetchData = async () => {
        try {
            setLoading(true)
            setError("")

            const [connRes, offersRes] = await Promise.all([
                fetch(`/api/supplier/vendors/${connectionId}`),
                fetch(`/api/supplier/vendors/${connectionId}/offers`)
            ])

            if (!connRes.ok) {
                const data = await connRes.json().catch(() => ({}))
                throw new Error(data.message || "Failed to load vendor")
            }

            const connData = await connRes.json()
            setConnection(connData.connection)

            if (offersRes.ok) {
                const offersData = await offersRes.json()
                setOffers(offersData.offers || [])
            } else {
                setOffers([])
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load vendor")
        } finally {
            setLoading(false)
        }
    }

    const openProvideModal = async () => {
        setShowProvideModal(true)
        setError("")
        setSuccess("")
        setSelectedProductId("")
        setPriceInput("")
        setQuantityInput("")

        try {
            setProductsLoading(true)
            const res = await fetch("/api/supplier/products")
            if (!res.ok) throw new Error("Failed to load products")
            const data = await res.json()
            const allProducts: SupplierProduct[] = (data.products || []).filter(
                (p: SupplierProduct) => !p.isSynced
            )

            // Filter out products already offered to this vendor
            const offeredProductIds = new Set(offers.map((o) => o.product.id))
            const availableProducts = allProducts.filter((p) => !offeredProductIds.has(p.id))
            setProducts(availableProducts)
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load products")
        } finally {
            setProductsLoading(false)
        }
    }

    const handleCreateOffer = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!connectionId || !selectedProductId) return

        const price = parseFloat(priceInput)
        const quantity = parseInt(quantityInput, 10)

        if (Number.isNaN(price) || Number.isNaN(quantity)) {
            setError("Please enter valid price and quantity")
            return
        }

        setSubmittingOffer(true)
        setError("")

        try {
            const res = await fetch(`/api/supplier/vendors/${connectionId}/offers`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    productId: selectedProductId,
                    price,
                    quantity
                })
            })

            const data = await res.json()
            if (!res.ok) {
                throw new Error(data.message || "Failed to provide product")
            }

            setSuccess(data.message || "Product provided to vendor successfully")
            setShowProvideModal(false)
            setSelectedProductId("")
            setPriceInput("")
            setQuantityInput("")
            fetchData()
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to provide product")
        } finally {
            setSubmittingOffer(false)
        }
    }

    const handleUpdateOffer = async (offerId: string, price: number, quantity: number) => {
        setError("")
        setSuccess("")
        try {
            const res = await fetch(`/api/supplier/vendors/offers/${offerId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ price, quantity })
            })
            const data = await res.json()
            if (!res.ok) {
                throw new Error(data.message || "Failed to update offer")
            }
            setSuccess(data.message || "Offer updated successfully")
            fetchData()
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to update offer")
        }
    }

    const handleWithdrawOffer = async (offerId: string) => {
        if (!confirm("Are you sure you want to withdraw this product from the vendor?")) return
        setError("")
        setSuccess("")

        try {
            const res = await fetch(`/api/supplier/vendors/offers/${offerId}`, {
                method: "DELETE"
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                throw new Error(data.message || "Failed to withdraw offer")
            }
            setSuccess(data.message || "Offer withdrawn successfully")
            setOffers((prev) => prev.filter((o) => o.id !== offerId))
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to withdraw offer")
        }
    }

    const selectedProduct = products.find((p) => p.id === selectedProductId) || null

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <button
                    type="button"
                    onClick={() => router.push("/supplier/vendors")}
                    className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                    <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                        Vendor Details
                    </h1>
                    <p className="text-sm md:text-base text-slate-400 mt-1">
                        View store information and provide products to this vendor.
                    </p>
                </div>
            </div>

            {success && (
                <div className="bg-emerald-500/20 border border-emerald-500/30 rounded-xl p-4 flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-emerald-400" />
                    <span className="text-sm text-emerald-400 font-medium">{success}</span>
                </div>
            )}

            {error && (
                <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-4 flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-red-400" />
                    <span className="text-sm text-red-400 font-medium">{error}</span>
                </div>
            )}

            {loading || !connection ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="bg-white/5 rounded-xl p-6 border border-white/10 lg:col-span-1">
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <Building2 className="w-5 h-5 text-slate-400" />
                                    <div>
                                        <h2 className="text-lg font-bold text-white">
                                            {connection.store.businessName}
                                        </h2>
                                        {connection.store.shopifyStoreName && (
                                            <p className="text-sm text-slate-400">
                                                {connection.store.shopifyStoreName}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3 text-sm text-slate-300">
                                <div className="flex items-center gap-2">
                                    <Mail className="w-4 h-4 text-slate-400" />
                                    <span>{connection.store.user.email}</span>
                                </div>
                                {connection.store.shopifyDomain && (
                                    <div className="flex items-center gap-2">
                                        <Globe className="w-4 h-4 text-slate-400" />
                                        <span className="truncate">{connection.store.shopifyDomain}</span>
                                    </div>
                                )}
                                <p className="text-xs text-slate-500">
                                    Connected on{" "}
                                    {new Date(connection.createdAt).toLocaleDateString()}
                                </p>
                            </div>
                        </div>

                        <div className="lg:col-span-2 flex flex-col gap-4">
                            <div className="flex items-center justify-between">
                                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                    <Package className="w-5 h-5 text-slate-400" />
                                    Products provided to this vendor
                                </h2>
                                <button
                                    type="button"
                                    onClick={openProvideModal}
                                    disabled={connection.status !== "CONNECTED"}
                                    className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                                >
                                    <Plus className="w-4 h-4" />
                                    Provide Product
                                </button>
                            </div>

                            {offers.length === 0 ? (
                                <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-sm text-slate-400 flex flex-col items-center justify-center gap-2">
                                    <Package className="w-8 h-8 opacity-30" />
                                    <p>No products have been provided to this vendor yet.</p>
                                    <p>Click &quot;Provide Product&quot; to send your first product.</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {offers.map((offer) => (
                                        <div
                                            key={offer.id}
                                            className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col md:flex-row md:items-center gap-4"
                                        >
                                            <div className="flex items-center gap-4 flex-1">
                                                <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-white/10 flex-shrink-0">
                                                    {offer.product.imageUrl ? (
                                                        <Image
                                                            src={offer.product.imageUrl}
                                                            alt={offer.product.title}
                                                            fill
                                                            className="object-cover"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-slate-500">
                                                            <Package className="w-6 h-6" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-sm font-semibold text-white">
                                                        {offer.product.title}
                                                    </p>
                                                    {offer.product.sku && (
                                                        <p className="text-xs text-slate-500">
                                                            SKU: {offer.product.sku}
                                                        </p>
                                                    )}
                                                    <p className="text-xs text-slate-500">
                                                        Provided on{" "}
                                                        {new Date(offer.createdAt).toLocaleDateString()}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-6 md:gap-8">
                                                <div>
                                                    <p className="text-xs text-slate-500 uppercase tracking-wide">
                                                        Price for this vendor
                                                    </p>
                                                    <p className="text-lg font-bold text-white">
                                                        ${offer.price.toFixed(2)}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-slate-500 uppercase tracking-wide">
                                                        Quantity
                                                    </p>
                                                    <p className="text-lg font-bold text-white">
                                                        {offer.quantity}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 md:flex-col md:items-stretch">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        handleUpdateOffer(
                                                            offer.id,
                                                            offer.price,
                                                            offer.quantity
                                                        )
                                                    }
                                                    className="flex-1 px-3 py-2 bg-white/10 hover:bg-white/15 text-slate-200 rounded-lg text-sm font-medium flex items-center justify-center gap-2"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                    Edit
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleWithdrawOffer(offer.id)}
                                                    className="flex-1 px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm font-medium flex items-center justify-center gap-2"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                    Withdraw
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}

            {showProvideModal && (
                <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-white/10 rounded-2xl shadow-xl max-w-3xl w-full mx-4 max-h-[80vh] flex flex-col">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                            <div className="flex items-center gap-2">
                                <Package className="w-5 h-5 text-indigo-400" />
                                <h2 className="text-lg font-bold text-white">
                                    Provide product to {connection?.store.businessName}
                                </h2>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowProvideModal(false)}
                                className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleCreateOffer} className="flex-1 flex flex-col overflow-hidden">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 px-6 py-4 overflow-y-auto">
                                <div className="space-y-3">
                                    <label className="block text-sm font-medium text-slate-300">
                                        Select product from your catalog
                                    </label>
                                    {productsLoading ? (
                                        <div className="flex items-center justify-center py-10 text-slate-400">
                                            <Loader2 className="w-5 h-5 animate-spin mr-2" />
                                            Loading products...
                                        </div>
                                    ) : products.length === 0 ? (
                                        <p className="text-sm text-slate-500">
                                            You have no available products to provide. Create a product in
                                            your Products tab first.
                                        </p>
                                    ) : (
                                        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                                            {products.map((product) => (
                                                <button
                                                    key={product.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedProductId(product.id)
                                                        setPriceInput(product.price.toString())
                                                    }}
                                                    className={`w-full flex items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${
                                                        selectedProductId === product.id
                                                            ? "border-indigo-500 bg-indigo-500/10"
                                                            : "border-white/10 hover:border-white/20"
                                                    }`}
                                                >
                                                    <div className="relative w-10 h-10 rounded-md overflow-hidden bg-white/10 flex-shrink-0">
                                                        {product.imageUrl ? (
                                                            <Image
                                                                src={product.imageUrl}
                                                                alt={product.title}
                                                                fill
                                                                className="object-cover"
                                                            />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center text-slate-500">
                                                                <Package className="w-4 h-4" />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-semibold text-white truncate">
                                                            {product.title}
                                                        </p>
                                                        {product.sku && (
                                                            <p className="text-xs text-slate-500">
                                                                SKU: {product.sku}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <div className="text-sm text-slate-300 font-medium">
                                                        ${product.price.toFixed(2)}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-4">
                                    {!selectedProduct && (
                                        <div className="h-full flex flex-col items-center justify-center text-slate-500 text-sm bg-white/5 border border-dashed border-white/10 rounded-xl px-4 py-6">
                                            <p className="font-medium text-slate-300 mb-1">
                                                Select a product to configure pricing
                                            </p>
                                            <p className="text-xs text-slate-500 text-center">
                                                Choose a product from your catalog on the left. Price and total
                                                items will appear here after you make a selection.
                                            </p>
                                        </div>
                                    )}

                                    {selectedProduct && (
                                        <>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-300 mb-1">
                                                    Price for this vendor
                                                </label>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-slate-400">$</span>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        value={priceInput}
                                                        onChange={(e) => setPriceInput(e.target.value)}
                                                        className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50"
                                                        placeholder="0.00"
                                                    />
                                                </div>
                                                <p className="mt-1 text-xs text-slate-500">
                                                    Base catalog price: ${selectedProduct.price.toFixed(2)}
                                                </p>
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-slate-300 mb-1">
                                                    Total items (quantity)
                                                </label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={quantityInput}
                                                    onChange={(e) => setQuantityInput(e.target.value)}
                                                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50"
                                                    placeholder="e.g. 100"
                                                />
                                            </div>

                                            <div className="mt-4 bg-white/5 border border-white/10 rounded-lg p-3 text-xs text-slate-400 space-y-1">
                                                <p className="font-semibold text-slate-200">
                                                    Preview: {selectedProduct.title}
                                                </p>
                                                {selectedProduct.description && (
                                                    <p className="line-clamp-3">
                                                        {selectedProduct.description}
                                                    </p>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10">
                                <button
                                    type="button"
                                    onClick={() => setShowProvideModal(false)}
                                    className="px-4 py-2 rounded-lg border border-white/10 text-slate-200 hover:bg-white/5 transition-colors text-sm font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={
                                        submittingOffer ||
                                        !selectedProductId ||
                                        !priceInput ||
                                        !quantityInput
                                    }
                                    className="px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium flex items-center gap-2"
                                >
                                    {submittingOffer ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Sending...
                                        </>
                                    ) : (
                                        <>
                                            <Plus className="w-4 h-4" />
                                            Send product
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}

