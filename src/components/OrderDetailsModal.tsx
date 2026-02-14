"use client"

import { X, ShoppingBag, User, Calendar, DollarSign, Package, MapPin, Phone, Mail, CheckCircle2, Clock } from "lucide-react"
import { useEffect, useState } from "react"

interface LineItem {
    id: number
    title: string
    quantity: number
    price: string
    sku?: string
    variant_title?: string
}

interface OrderDetails {
    id: number
    name: string
    order_number?: number
    email: string
    created_at: string
    updated_at?: string
    total_price: string
    subtotal_price?: string
    total_tax?: string
    total_discounts?: string
    currency: string
    financial_status: string
    fulfillment_status: string | null
    customer: {
        id?: number
        first_name: string
        last_name: string
        email: string
        phone?: string
    } | null
    shipping_address?: {
        first_name: string
        last_name: string
        address1: string
        address2?: string
        city: string
        province: string
        country: string
        zip: string
        phone?: string
    }
    billing_address?: {
        first_name: string
        last_name: string
        address1: string
        address2?: string
        city: string
        province: string
        country: string
        zip: string
    }
    line_items: LineItem[]
    note?: string
    tags?: string
}

interface OrderDetailsModalProps {
    isOpen: boolean
    onClose: () => void
    orderId: number
    orderName: string
}

export default function OrderDetailsModal({ isOpen, onClose, orderId, orderName }: OrderDetailsModalProps) {
    const [order, setOrder] = useState<OrderDetails | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState("")

    const fetchOrderDetails = async () => {
        setLoading(true)
        setError("")
        try {
            const res = await fetch(`/api/shopify/orders/${orderId}`)
            if (!res.ok) throw new Error("Failed to fetch order details")
            const data = await res.json()
            setOrder(data.order)
        } catch {
            setError("Failed to load order details. Please try again.")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (isOpen && orderId) {
            fetchOrderDetails()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, orderId])

    // Prevent body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden"
        } else {
            document.body.style.overflow = ""
        }
        return () => {
            document.body.style.overflow = ""
        }
    }, [isOpen])

    if (!isOpen) return null

    return (
        <div
            className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-md overflow-y-auto overflow-x-hidden"
            onClick={(e) => {
                if (e.target === e.currentTarget) {
                    onClose()
                }
            }}
        >
            <div className="min-h-screen flex items-center justify-center p-4 py-8">
                <div
                    className="bg-slate-900 rounded-2xl border border-white/10 w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl mx-auto"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 md:p-6 border-b border-white/10 flex-shrink-0 bg-slate-900/95 backdrop-blur-sm">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/20 flex items-center justify-center">
                                <ShoppingBag className="w-5 h-5 text-indigo-400" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-white">Order Details</h2>
                                <p className="text-sm text-slate-400">{orderName}</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 min-h-0 bg-slate-900 max-w-full" style={{ maxHeight: 'calc(90vh - 140px)' }}>
                        {loading ? (
                            <div className="flex items-center justify-center h-64">
                                <div className="text-slate-400">Loading order details...</div>
                            </div>
                        ) : error ? (
                            <div className="flex items-center justify-center h-64">
                                <div className="text-red-400">{error}</div>
                            </div>
                        ) : order ? (
                            <div className="space-y-6 max-w-full overflow-hidden">
                                {/* Order Summary - Top Section */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-white/5 rounded-xl p-5 border border-white/10">
                                        <div className="flex items-center gap-2 text-slate-400 mb-3">
                                            <Calendar className="w-4 h-4" />
                                            <span className="text-xs font-bold uppercase tracking-wider">Order Date</span>
                                        </div>
                                        <p className="text-white font-bold text-lg">{new Date(order.created_at).toLocaleString()}</p>
                                    </div>
                                    <div className="bg-white/5 rounded-xl p-5 border border-white/10">
                                        <div className="flex items-center gap-2 text-slate-400 mb-3">
                                            <DollarSign className="w-4 h-4" />
                                            <span className="text-xs font-bold uppercase tracking-wider">Total Amount</span>
                                        </div>
                                        <p className="text-white font-bold text-2xl">{order.total_price} {order.currency}</p>
                                    </div>
                                </div>

                                {/* Status Cards */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-white/5 rounded-xl p-5 border border-white/10">
                                        <span className="text-xs font-bold uppercase text-slate-400 tracking-wider block mb-3">Payment Status</span>
                                        <div>
                                            <span className={`px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider inline-flex items-center gap-1.5 ${order.financial_status === "paid"
                                                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                                    : "bg-red-500/20 text-red-400 border border-red-500/30"
                                                }`}>
                                                {order.financial_status === "paid" && <CheckCircle2 className="w-3 h-3" />}
                                                {order.financial_status}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="bg-white/5 rounded-xl p-5 border border-white/10">
                                        <span className="text-xs font-bold uppercase text-slate-400 tracking-wider block mb-3">Fulfillment Status</span>
                                        <div>
                                            <span className={`px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider inline-flex items-center gap-1.5 ${order.fulfillment_status === "fulfilled"
                                                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                                    : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                                                }`}>
                                                {order.fulfillment_status === "fulfilled" ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                                                {order.fulfillment_status || "Unfulfilled"}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Main Content Grid */}
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-w-0 max-w-full">
                                    {/* Left Column - Customer & Shipping */}
                                    <div className="lg:col-span-1 space-y-6 min-w-0 max-w-full">
                                        {/* Customer Info */}
                                        {order.customer && (
                                            <div className="bg-white/5 rounded-xl p-5 border border-white/10">
                                                <div className="flex items-center gap-2 text-slate-400 mb-4">
                                                    <User className="w-4 h-4" />
                                                    <span className="text-xs font-bold uppercase tracking-wider">Customer</span>
                                                </div>
                                                <div className="space-y-3">
                                                    <p className="text-white font-bold text-base">
                                                        {order.customer.first_name} {order.customer.last_name}
                                                    </p>
                                                    <div className="flex items-center gap-2 text-slate-300 text-sm min-w-0">
                                                        <Mail className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                                                        <span className="break-all min-w-0">{order.customer.email}</span>
                                                    </div>
                                                    {order.customer.phone && (
                                                        <div className="flex items-center gap-2 text-slate-300 text-sm">
                                                            <Phone className="w-3.5 h-3.5 text-slate-500" />
                                                            <span>{order.customer.phone}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* Shipping Address */}
                                        {order.shipping_address && (
                                            <div className="bg-white/5 rounded-xl p-5 border border-white/10">
                                                <div className="flex items-center gap-2 text-slate-400 mb-4">
                                                    <MapPin className="w-4 h-4" />
                                                    <span className="text-xs font-bold uppercase tracking-wider">Shipping Address</span>
                                                </div>
                                                <div className="text-slate-300 text-sm space-y-1.5 break-words">
                                                    <p className="font-medium text-white break-words">
                                                        {order.shipping_address.first_name} {order.shipping_address.last_name}
                                                    </p>
                                                    <p className="break-words">{order.shipping_address.address1}</p>
                                                    {order.shipping_address.address2 && <p className="break-words">{order.shipping_address.address2}</p>}
                                                    <p className="break-words">
                                                        {order.shipping_address.city}, {order.shipping_address.province} {order.shipping_address.zip}
                                                    </p>
                                                    <p className="break-words">{order.shipping_address.country}</p>
                                                    {order.shipping_address.phone && (
                                                        <p className="mt-2 flex items-center gap-2 pt-2 border-t border-white/5">
                                                            <Phone className="w-3.5 h-3.5 text-slate-500" />
                                                            {order.shipping_address.phone}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Right Column - Order Items */}
                                    <div className="lg:col-span-2 min-w-0 max-w-full overflow-hidden">
                                        <div className="bg-white/5 rounded-xl p-5 border border-white/10 min-w-0 max-w-full overflow-hidden">
                                            <div className="flex items-center gap-2 text-slate-400 mb-5">
                                                <Package className="w-4 h-4" />
                                                <span className="text-xs font-bold uppercase tracking-wider">Order Items</span>
                                            </div>
                                            <div className="space-y-4 overflow-x-auto">
                                                {order.line_items.map((item) => (
                                                    <div key={item.id} className="bg-white/5 rounded-lg p-4 border border-white/5 min-w-0">
                                                        <div className="flex items-start justify-between gap-4 min-w-0">
                                                            <div className="flex-1 min-w-0 overflow-hidden">
                                                                <p className="text-white font-bold text-base mb-1 break-words">{item.title}</p>
                                                                {item.variant_title && (
                                                                    <p className="text-sm text-slate-400 mb-2 break-words">{item.variant_title}</p>
                                                                )}
                                                                <div className="flex items-center gap-4 flex-wrap">
                                                                    <span className="text-sm text-slate-400">
                                                                        <span className="font-medium text-slate-300">Qty:</span> {item.quantity}
                                                                    </span>
                                                                    {item.sku && (
                                                                        <span className="text-xs text-slate-500 break-all">
                                                                            <span className="font-medium">SKU:</span> {item.sku}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="text-right flex-shrink-0">
                                                                <p className="text-white font-bold text-lg whitespace-nowrap">
                                                                    {(parseFloat(item.price) * item.quantity).toFixed(2)} {order.currency}
                                                                </p>
                                                                <p className="text-xs text-slate-400 mt-1 whitespace-nowrap">
                                                                    {parseFloat(item.price).toFixed(2)} {order.currency} each
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Order Summary */}
                                            {(order.subtotal_price || order.total_tax || (order.total_discounts && parseFloat(order.total_discounts) > 0)) && (
                                                <div className="mt-6 pt-6 border-t border-white/10 space-y-3">
                                                    {order.subtotal_price && (
                                                        <div className="flex justify-between text-sm">
                                                            <span className="text-slate-400">Subtotal</span>
                                                            <span className="text-white font-medium">{order.subtotal_price} {order.currency}</span>
                                                        </div>
                                                    )}
                                                    {order.total_tax && (
                                                        <div className="flex justify-between text-sm">
                                                            <span className="text-slate-400">Tax</span>
                                                            <span className="text-white font-medium">{order.total_tax} {order.currency}</span>
                                                        </div>
                                                    )}
                                                    {order.total_discounts && parseFloat(order.total_discounts) > 0 && (
                                                        <div className="flex justify-between text-sm">
                                                            <span className="text-slate-400">Discount</span>
                                                            <span className="text-emerald-400 font-medium">-{order.total_discounts} {order.currency}</span>
                                                        </div>
                                                    )}
                                                    <div className="flex justify-between text-lg font-bold pt-3 border-t border-white/10">
                                                        <span className="text-white">Total</span>
                                                        <span className="text-white">{order.total_price} {order.currency}</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Order Notes */}
                                        {order.note && (
                                            <div className="bg-white/5 rounded-xl p-5 border border-white/10 mt-6">
                                                <span className="text-xs font-bold uppercase text-slate-400 tracking-wider block mb-3">Order Notes</span>
                                                <p className="text-slate-300 text-sm leading-relaxed">{order.note}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : null}
                    </div>

                    {/* Footer */}
                    <div className="p-4 md:p-6 border-t border-white/10 flex justify-end flex-shrink-0 bg-slate-900/95 backdrop-blur-sm">
                        <button
                            onClick={onClose}
                            className="px-6 py-2.5 bg-indigo-500 text-white rounded-xl font-bold hover:bg-indigo-600 transition-colors"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
