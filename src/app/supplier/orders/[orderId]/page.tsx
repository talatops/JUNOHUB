"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Loader2, AlertCircle, Package, Truck, Save, CheckCircle2, User, Mail, Phone, MapPin } from "lucide-react"
import toast from "react-hot-toast"

const SHOPIFY_TRACKING_COMPANIES = [
    "4PX",
    "Amazon Logistics UK",
    "An Post",
    "Australia Post",
    "UPS",
    "USPS",
    "FedEx",
    "DHL Express",
    "DHL eCommerce",
    "Canada Post",
    "China Post",
    "DPD",
    "Royal Mail",
    "Purolator",
    "OnTrac",
    "GLS",
    "PostNL",
    "Singapore Post",
    "La Poste",
    "Yodel",
    "Evri",
    "Japan Post",
    "New Zealand Post",
    "Aramex",
    "Other",
]

type SupplierOrder = {
    id: string
    orderNumber: string
    email?: string | null
    totalPrice: string
    currency?: string | null
    financialStatus?: string | null
    fulfillmentStatus: string
    trackingNumber?: string | null
    trackingCompany?: string | null
    trackingUrl?: string | null
    createdAt: string
    lineItems: Array<{ id?: number; title?: string; quantity?: number; price?: string; sku?: string; variant_title?: string; product_id?: number }>
    customer?: { first_name?: string; last_name?: string; email?: string; phone?: string } | null
    shippingAddress?: { first_name?: string; last_name?: string; address1?: string; address2?: string; city?: string; province?: string; country?: string; zip?: string; phone?: string } | null
    billingAddress?: { first_name?: string; last_name?: string; address1?: string; address2?: string; city?: string; province?: string; country?: string; zip?: string; phone?: string } | null
    store: { id: string; businessName: string; shopifyStoreName: string }
}

export default function SupplierOrderDetailsPage() {
    const router = useRouter()
    const params = useParams()
    const orderId = params?.orderId as string

    const [order, setOrder] = useState<SupplierOrder | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState("")

    const [fulfillmentStatus, setFulfillmentStatus] = useState("UNFULFILLED")
    const [trackingNumber, setTrackingNumber] = useState("")
    const [trackingCompany, setTrackingCompany] = useState("")
    const [trackingUrl, setTrackingUrl] = useState("")

    useEffect(() => {
        if (!orderId) return
        const fetchOrder = async () => {
            setLoading(true)
            setError("")
            try {
                const res = await fetch(`/api/supplier/orders/${orderId}`)
                if (!res.ok) throw new Error("Failed to load order")
                const data = await res.json()
                const o = data.order as SupplierOrder
                setOrder(o)
                setFulfillmentStatus(o.fulfillmentStatus || "UNFULFILLED")
                setTrackingNumber(o.trackingNumber || "")
                setTrackingCompany(o.trackingCompany || "")
                setTrackingUrl(o.trackingUrl || "")
            } catch {
                setError("Failed to load order details.")
            } finally {
                setLoading(false)
            }
        }
        fetchOrder()
    }, [orderId])

    const changed = useMemo(() => {
        if (!order) return false
        return (
            fulfillmentStatus !== (order.fulfillmentStatus || "UNFULFILLED") ||
            trackingNumber !== (order.trackingNumber || "") ||
            trackingCompany !== (order.trackingCompany || "") ||
            trackingUrl !== (order.trackingUrl || "")
        )
    }, [order, fulfillmentStatus, trackingNumber, trackingCompany, trackingUrl])

    const save = async () => {
        if (!order) return
        setSaving(true)
        try {
            const res = await fetch(`/api/supplier/orders/${order.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    fulfillmentStatus,
                    trackingNumber,
                    trackingCompany,
                    trackingUrl,
                }),
            })
            if (!res.ok) throw new Error("Failed to save")
            toast.success("Order updated successfully")
            setOrder({
                ...order,
                fulfillmentStatus,
                trackingNumber,
                trackingCompany,
                trackingUrl,
            })
        } catch {
            toast.error("Failed to update order")
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
            </div>
        )
    }

    if (error || !order) {
        return (
            <div className="h-full flex flex-col items-center justify-center gap-4 text-red-400">
                <AlertCircle className="w-8 h-8" />
                <p>{error || "Order not found"}</p>
                <button onClick={() => router.back()} className="px-4 py-2 rounded-lg bg-white/10 text-white">Back</button>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-white/10 text-slate-300">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-extrabold text-white">Order {order.orderNumber}</h1>
                        <p className="text-slate-400 text-sm">{order.store.businessName}</p>
                    </div>
                </div>
                <button
                    onClick={save}
                    disabled={!changed || saving}
                    className="h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold inline-flex items-center gap-2"
                >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Changes
                </button>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-stretch">
                <div className="xl:col-span-2 space-y-6">
                    <div className="bg-white/5 border border-white/10 rounded-xl p-5 h-full">
                    <h2 className="text-white font-bold mb-4 inline-flex items-center gap-2">
                        <Package className="w-4 h-4 text-indigo-400" />
                        Order Snapshot
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                            <p className="text-xs uppercase text-slate-400 font-bold">Created</p>
                            <p className="text-white font-semibold mt-1">{new Date(order.createdAt).toLocaleString()}</p>
                        </div>
                        <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                            <p className="text-xs uppercase text-slate-400 font-bold">Total</p>
                            <p className="text-white font-semibold mt-1">{order.totalPrice} {order.currency || ""}</p>
                        </div>
                        <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                            <p className="text-xs uppercase text-slate-400 font-bold">Payment</p>
                            <p className="text-white font-semibold mt-1">{order.financialStatus || "N/A"}</p>
                        </div>
                    </div>
                </div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-4 h-full">
                    <h2 className="text-white font-bold inline-flex items-center gap-2">
                        <Truck className="w-4 h-4 text-indigo-400" />
                        Fulfillment Update
                    </h2>

                    <div>
                        <label className="block text-xs uppercase text-slate-400 font-bold mb-2">Order Status</label>
                        <select
                            value={fulfillmentStatus}
                            onChange={(e) => setFulfillmentStatus(e.target.value)}
                            className="w-full h-11 rounded-xl bg-white/10 border border-white/10 text-white px-3"
                        >
                            <option value="UNFULFILLED">Unfulfilled</option>
                            <option value="IN_PROGRESS">In Progress</option>
                            <option value="SHIPPED">Shipped</option>
                            <option value="FULFILLED">Fulfilled</option>
                            <option value="CANCELLED">Cancelled</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs uppercase text-slate-400 font-bold mb-2">Tracking Platform</label>
                        <select
                            value={trackingCompany}
                            onChange={(e) => setTrackingCompany(e.target.value)}
                            className="w-full h-11 rounded-xl bg-white/10 border border-white/10 text-white px-3"
                        >
                            <option value="">Select platform</option>
                            {SHOPIFY_TRACKING_COMPANIES.map((c) => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs uppercase text-slate-400 font-bold mb-2">Tracking ID</label>
                        <input
                            value={trackingNumber}
                            onChange={(e) => setTrackingNumber(e.target.value)}
                            placeholder="e.g. 1Z999AA10123456784"
                            className="w-full h-11 rounded-xl bg-white/10 border border-white/10 text-white px-3"
                        />
                    </div>

                    <div>
                        <label className="block text-xs uppercase text-slate-400 font-bold mb-2">Tracking URL (optional)</label>
                        <input
                            value={trackingUrl}
                            onChange={(e) => setTrackingUrl(e.target.value)}
                            placeholder="https://..."
                            className="w-full h-11 rounded-xl bg-white/10 border border-white/10 text-white px-3"
                        />
                    </div>

                    {changed && (
                        <p className="text-emerald-400 text-xs font-semibold inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Unsaved changes
                        </p>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
                <div className="bg-white/5 border border-white/10 rounded-xl p-5 h-full min-h-[190px]">
                    <h2 className="text-white font-bold mb-4 inline-flex items-center gap-2">
                        <User className="w-4 h-4 text-indigo-400" />
                        Customer
                    </h2>
                    <div className="space-y-2 text-sm">
                        <p className="text-white font-semibold">
                            {[order.customer?.first_name, order.customer?.last_name].filter(Boolean).join(" ") || "—"}
                        </p>
                        <p className="text-slate-300 inline-flex items-center gap-2 break-all">
                            <Mail className="w-3.5 h-3.5 text-slate-500" />
                            {order.customer?.email || order.email || "Email: --"}
                        </p>
                        <p className="text-slate-300 inline-flex items-center gap-2">
                            <Phone className="w-3.5 h-3.5 text-slate-500" />
                            {order.customer?.phone || "Phone: --"}
                        </p>
                    </div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-xl p-5 h-full min-h-[190px]">
                    <h2 className="text-white font-bold mb-4 inline-flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-indigo-400" />
                        Shipping Address
                    </h2>
                    {order.shippingAddress ? (
                        <div className="text-sm text-slate-300 space-y-1.5">
                            <p className="text-white font-semibold">
                                {[order.shippingAddress.first_name, order.shippingAddress.last_name].filter(Boolean).join(" ")}
                            </p>
                            <p>{order.shippingAddress.address1 || "--"}</p>
                            {order.shippingAddress.address2 ? <p>{order.shippingAddress.address2}</p> : null}
                            <p>{[order.shippingAddress.city, order.shippingAddress.province, order.shippingAddress.zip].filter(Boolean).join(", ") || "--"}</p>
                            <p>{order.shippingAddress.country || "--"}</p>
                        </div>
                    ) : (
                        <p className="text-slate-500 text-sm">No shipping address available.</p>
                    )}
                </div>

                <div className="bg-white/5 border border-white/10 rounded-xl p-5 h-full min-h-[190px]">
                    <h2 className="text-white font-bold mb-4 inline-flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-indigo-400" />
                        Billing Address
                    </h2>
                    {order.billingAddress ? (
                        <div className="text-sm text-slate-300 space-y-1.5">
                            <p className="text-white font-semibold">
                                {[order.billingAddress.first_name, order.billingAddress.last_name].filter(Boolean).join(" ")}
                            </p>
                            <p>{order.billingAddress.address1 || "--"}</p>
                            {order.billingAddress.address2 ? <p>{order.billingAddress.address2}</p> : null}
                            <p>{[order.billingAddress.city, order.billingAddress.province, order.billingAddress.zip].filter(Boolean).join(", ") || "--"}</p>
                            <p>{order.billingAddress.country || "--"}</p>
                        </div>
                    ) : (
                        <p className="text-slate-500 text-sm">No billing address available.</p>
                    )}
                </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                <h2 className="text-white font-bold mb-4 inline-flex items-center gap-2">
                    <Package className="w-4 h-4 text-indigo-400" />
                    Order Items
                </h2>
                <div className="space-y-3">
                    {order.lineItems.length === 0 ? (
                        <p className="text-slate-500 text-sm">No items available.</p>
                    ) : order.lineItems.map((item, idx) => (
                        <div key={`${item.id || idx}`} className="bg-white/5 border border-white/10 rounded-lg p-4 flex items-start justify-between gap-4">
                            <div className="min-w-0">
                                <p className="text-white font-semibold break-words">{item.title || "Item"}</p>
                                {item.variant_title ? <p className="text-slate-400 text-xs mt-1">{item.variant_title}</p> : null}
                                <p className="text-slate-400 text-xs mt-1">Qty: {item.quantity || 0}{item.sku ? ` · SKU: ${item.sku}` : ""}</p>
                            </div>
                            <p className="text-white font-semibold whitespace-nowrap">
                                {((Number(item.price || 0) || 0) * (item.quantity || 0)).toFixed(2)} {order.currency || ""}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

