"use client"

import { useEffect, useState, useRef } from "react"
import {
    Package,
    Plus,
    Search,
    Edit,
    Trash2,
    Loader2,
    AlertCircle,
    Image as ImageIcon,
    X,
    CheckCircle2,
    Building2
} from "lucide-react"
import Image from "next/image"
import { useTheme } from "@/components/ThemeProvider"
import { cn } from "@/lib/utils"

interface Product {
    id: string
    title: string
    description: string | null
    price: number
    sku: string | null
    imageUrl: string | null
    createdAt: string
    updatedAt: string
    isSynced?: boolean // Flag for synced products from vendors
    syncId?: string // ID of the sync record
    shopifyProductId?: string // Shopify product ID for synced products
    vendor?: {
        id: string
        businessName: string
    }
}

export default function SupplierProductsPage() {
    const [products, setProducts] = useState<Product[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState("")
    const [success, setSuccess] = useState("")
    const [searchTerm, setSearchTerm] = useState("")
    const [showModal, setShowModal] = useState(false)
    const [editingProduct, setEditingProduct] = useState<Product | null>(null)
    const [formData, setFormData] = useState({
        title: "",
        description: "",
        price: "",
        sku: "",
        imageUrl: ""
    })
    const [imageFile, setImageFile] = useState<File | null>(null)
    const [submitting, setSubmitting] = useState(false)
    const { theme } = useTheme()
    const isLight = theme === "light"

    useEffect(() => {
        fetchProducts()
    }, [])

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

    const fetchProducts = async () => {
        try {
            setLoading(true)
            const res = await fetch("/api/supplier/products")
            if (!res.ok) throw new Error("Failed to fetch products")
            const data = await res.json()
            setProducts(data.products || [])
            setError("")
        } catch {
            setError("Failed to load products")
        } finally {
            setLoading(false)
        }
    }

    const handleAdd = () => {
        setEditingProduct(null)
        setFormData({
            title: "",
            description: "",
            price: "",
            sku: "",
            imageUrl: ""
        })
        setImageFile(null)
        setShowModal(true)
    }

    const handleEdit = (product: Product) => {
        setEditingProduct(product)
        setFormData({
            title: product.title,
            description: product.description || "",
            price: product.price.toString(),
            sku: product.sku || "",
            imageUrl: product.imageUrl || ""
        })
        setImageFile(null)
        setShowModal(true)
    }

    const handleDelete = async (productId: string) => {
        // Check if this is a synced product
        const product = products.find(p => p.id === productId)
        if (product?.isSynced) {
            setError("Synced products from vendors cannot be deleted. You can only edit them.")
            return
        }

        if (!confirm("Are you sure you want to delete this product?")) return

        try {
            const res = await fetch(`/api/supplier/products/${productId}`, {
                method: "DELETE"
            })
            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.message || "Failed to delete product")
            }
            setSuccess("Product deleted successfully")
            fetchProducts()
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to delete product")
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setSubmitting(true)
        setError("")

        try {
            const url = editingProduct
                ? `/api/supplier/products/${editingProduct.id}`
                : "/api/supplier/products"
            const method = editingProduct ? "PUT" : "POST"

            // If a new image file is selected, upload it first to get a URL
            let finalImageUrl = formData.imageUrl || null
            if (imageFile) {
                const fd = new FormData()
                fd.append("file", imageFile)
                const uploadRes = await fetch("/api/uploads/supplier-product-image", {
                    method: "POST",
                    body: fd
                })
                if (!uploadRes.ok) {
                    const data = await uploadRes.json().catch(() => ({}))
                    throw new Error(data.message || "Failed to upload image")
                }
                const uploadData = await uploadRes.json()
                finalImageUrl = uploadData.url || null
            }

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: formData.title,
                    description: formData.description || null,
                    price: parseFloat(formData.price),
                    sku: formData.sku || null,
                    imageUrl: finalImageUrl
                })
            })

            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.message || "Failed to save product")
            }

            setSuccess(editingProduct ? "Product updated successfully" : "Product created successfully")
            setShowModal(false)
            fetchProducts()
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save product")
        } finally {
            setSubmitting(false)
        }
    }

    const filteredProducts = products.filter((product) =>
        product.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.sku?.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">Products</h1>
                    <p className="text-sm md:text-base text-slate-400 mt-1">Manage your product catalog</p>
                </div>
                <button
                    onClick={handleAdd}
                    className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-bold transition-colors flex items-center gap-2"
                >
                    <Plus className="w-4 h-4" />
                    Add Product
                </button>
            </div>

            {success && (
                <div className="bg-emerald-500/20 border border-emerald-500/30 rounded-xl p-4 flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <span className="text-sm text-emerald-400 font-medium">{success}</span>
                </div>
            )}

            {error && (
                <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-4 flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-red-400" />
                    <span className="text-sm text-red-400 font-medium">{error}</span>
                </div>
            )}

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                    type="text"
                    placeholder="Search products by name or SKU..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full h-12 bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50"
                />
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
                </div>
            ) : filteredProducts.length === 0 ? (
                <div className="bg-white/5 rounded-xl p-12 border border-white/10 text-center">
                    <Package className="w-12 h-12 text-slate-400 mx-auto mb-4 opacity-50" />
                    <p className="text-slate-400 font-medium">
                        {searchTerm ? "No products found matching your search" : "No products yet. Add your first product to get started."}
                    </p>
                </div>
            ) : (
                <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-white/5 border-b border-white/10">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Product</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">SKU</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Price</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/10">
                                {filteredProducts.map((product) => (
                                    <tr key={product.id} className="hover:bg-white/5 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                {product.imageUrl ? (
                                                    <Image
                                                        src={product.imageUrl}
                                                        alt={product.title}
                                                        width={40}
                                                        height={40}
                                                        className="rounded-lg object-cover"
                                                        unoptimized
                                                    />
                                                ) : (
                                                    <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                                                        <ImageIcon className="w-5 h-5 text-slate-400" />
                                                    </div>
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <div className="font-medium text-white truncate">{product.title}</div>
                                                        {product.isSynced && (
                                                            <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-400 rounded-full text-xs font-bold uppercase">
                                                                Synced
                                                            </span>
                                                        )}
                                                    </div>
                                                    {product.description && (
                                                        <div className="text-xs text-slate-400 line-clamp-1">{product.description.replace(/<[^>]*>/g, "")}</div>
                                                    )}
                                                    {product.isSynced && product.vendor && (
                                                        <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                                                            <Building2 className="w-3 h-3" />
                                                            <span>From {product.vendor.businessName}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-300">{product.sku || "—"}</td>
                                        <td className="px-6 py-4 text-sm font-medium text-white">${product.price.toFixed(2)}</td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => handleEdit(product)}
                                                    className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
                                                    title="Edit"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                {!product.isSynced && (
                                                    <button
                                                        onClick={() => handleDelete(product.id)}
                                                        className="p-2 hover:bg-red-500/20 rounded-lg text-slate-400 hover:text-red-400 transition-colors"
                                                        title="Delete"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div
                        className={cn(
                            "rounded-xl w-full max-w-md p-6 border transition-colors",
                            isLight
                                ? "bg-white border-slate-200 shadow-xl"
                                : "bg-slate-900 border-white/10"
                        )}
                    >
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-white">
                                {editingProduct ? "Edit Product" : "Add Product"}
                            </h2>
                            <button
                                onClick={() => setShowModal(false)}
                                className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-2">Title *</label>
                                <input
                                    type="text"
                                    required
                                    maxLength={500}
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50"
                                    placeholder="Product title"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-2">Description</label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    rows={3}
                                    maxLength={50_000}
                                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50"
                                    placeholder="Product description"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-2">Price *</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        required
                                        value={formData.price}
                                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                        className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50"
                                        placeholder="0.00"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-2">SKU</label>
                                    <input
                                        type="text"
                                        value={formData.sku}
                                        onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                                        maxLength={200}
                                        className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50"
                                        placeholder="SKU"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-2">Product image</label>
                                <div className="space-y-2">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0] || null
                                            setImageFile(file)
                                        }}
                                        className="block w-full text-sm text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-500 file:text-white hover:file:bg-indigo-600"
                                    />
                                    <p className="text-xs text-slate-500">
                                        Optional: you can also paste an external URL instead of uploading.
                                    </p>
                                    <input
                                        type="url"
                                        value={formData.imageUrl}
                                        onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                                        maxLength={4000}
                                        className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50"
                                        placeholder="https://example.com/image.jpg"
                                    />
                                    <p className="text-xs text-slate-500">
                                        If you upload a file and also provide a URL, the uploaded image will be used.
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="flex-1 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {submitting ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Saving...
                                        </>
                                    ) : (
                                        editingProduct ? "Update" : "Create"
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
