"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { ArrowLeft, ShoppingBag, User, Calendar, DollarSign, Package, MapPin, Phone, Mail, CheckCircle2, Clock, Loader2, AlertCircle, Truck } from "lucide-react"
import { useTheme } from "@/components/ThemeProvider"

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
    email?: string | null
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
        first_name?: string | null
        last_name?: string | null
        email?: string | null
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
    tracking_number?: string | null
    tracking_company?: string | null
    tracking_url?: string | null
    pending_vendor_sync?: boolean
    last_shopify_sync_error?: string | null
    hold_reason_code?: string | null
    hold_note?: string | null
    hold_reason_label?: string | null
}

export default function OrderDetailsPage() {
    const router = useRouter()
    const params = useParams()
    const orderId = params?.orderId as string
    const { theme } = useTheme()
    const isLight = theme === "light"
    const [order, setOrder] = useState<OrderDetails | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState("")

    useEffect(() => {
        if (!orderId) return

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

        fetchOrderDetails()
    }, [orderId])

    if (loading) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
                <p className="font-medium">Loading order details...</p>
            </div>
        )
    }

    if (error) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-red-400 gap-4 p-8 text-center">
                <div className="w-12 h-12 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center">
                    <AlertCircle className="w-6 h-6" />
                </div>
                <p className="font-bold">{error}</p>
                <button
                    onClick={() => router.back()}
                    className="px-6 py-2.5 bg-indigo-500 text-white rounded-xl font-bold hover:bg-indigo-600 transition-colors mt-4"
                >
                    Go Back
                </button>
            </div>
        )
    }

    if (!order) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3">
                <p className="font-medium">Order not found</p>
                <button
                    onClick={() => router.back()}
                    className="px-6 py-2.5 bg-indigo-500 text-white rounded-xl font-bold hover:bg-indigo-600 transition-colors mt-4"
                >
                    Go Back
                </button>
            </div>
        )
    }

    const contactEmail =
        [order.email, order.customer?.email]
            .map((e) => (typeof e === "string" ? e.trim() : ""))
            .find(Boolean) || ""

    const customerDisplayName = [order.customer?.first_name, order.customer?.last_name]
        .filter(Boolean)
        .join(" ")
        .trim()
    const hasCustomerData = Boolean(
        customerDisplayName || contactEmail || order.customer?.phone
    )

    return (
        <div className="h-full flex flex-col overflow-y-auto">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6 flex-shrink-0">
                <button
                    onClick={() => router.back()}
                    className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-3 min-w-0 flex-wrap">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/20 flex items-center justify-center">
                        <ShoppingBag className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div className="min-w-0">
                        <h1 className="text-xl md:text-2xl font-bold text-white">Order Details</h1>
                        <p className="text-sm text-slate-400">{order.name}</p>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto min-h-0">
                <div className="space-y-6">
                    {/* Order Summary & Status - Symmetric Top Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                        {/* Order Date */}
                        <div className="bg-white/5 rounded-xl p-5 border border-white/10 flex flex-col gap-3">
                            <div className="flex items-center gap-2 text-slate-400 mb-0">
                                <Calendar className="w-4 h-4" />
                                <span className="text-xs font-bold uppercase tracking-wider">Order Date</span>
                            </div>
                            <p className="text-white font-bold text-lg leading-snug">
                                {new Date(order.created_at).toLocaleString()}
                            </p>
                        </div>

                        {/* Total Amount */}
                        <div className="bg-white/5 rounded-xl p-5 border border-white/10 flex flex-col gap-3">
                            <div className="flex items-center gap-2 text-slate-400 mb-0">
                                <DollarSign className="w-4 h-4" />
                                <span className="text-xs font-bold uppercase tracking-wider">Total Amount</span>
                            </div>
                            <p className="text-white font-bold text-2xl leading-snug">
                                {order.total_price} {order.currency}
                            </p>
                        </div>

                        {/* Payment Status */}
                        <div className="bg-white/5 rounded-xl p-5 border border-white/10 flex flex-col gap-3">
                            <span className="text-xs font-bold uppercase text-slate-400 tracking-wider block">
                                Payment Status
                            </span>
                            <div>
                                <span
                                    className={`px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider inline-flex items-center gap-1.5 whitespace-nowrap ${
                                        order.financial_status === "paid"
                                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                            : "bg-red-500/20 text-red-400 border border-red-500/30"
                                    }`}
                                >
                                    {order.financial_status === "paid" && <CheckCircle2 className="w-3 h-3" />}
                                    {order.financial_status}
                                </span>
                            </div>
                        </div>

                        {/* Fulfillment Status */}
                        <div className="bg-white/5 rounded-xl p-5 border border-white/10 flex flex-col gap-3">
                            <span className="text-xs font-bold uppercase text-slate-400 tracking-wider block">
                                Fulfillment Status
                            </span>
                            <div>
                                <span
                                    className={`px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider inline-flex items-center gap-1.5 whitespace-nowrap ${
                                        order.fulfillment_status === "fulfilled"
                                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                            : order.fulfillment_status === "on_hold"
                                              ? isLight
                                                  ? "bg-amber-50 text-amber-800 border border-amber-300"
                                                  : "bg-amber-500/20 text-amber-300 border border-amber-500/35"
                                              : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                                    }`}
                                >
                                    {order.fulfillment_status === "fulfilled" ? (
                                        <CheckCircle2 className="w-3 h-3" />
                                    ) : (
                                        <Clock className="w-3 h-3" />
                                    )}
                                    {order.fulfillment_status === "on_hold"
                                        ? "On hold"
                                        : order.fulfillment_status || "Unfulfilled"}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Main Content Grid */}
                    <div className="bg-white/5 rounded-xl p-5 border border-white/10">
                        <div className="flex items-center justify-between gap-3 mb-4">
                            <h3 className="text-white font-bold inline-flex items-center gap-2">
                                <Truck className="w-4 h-4 text-indigo-400" />
                                Fulfillment & Tracking
                            </h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                            <div className="h-11 rounded-xl bg-white/10 border border-white/10 text-white px-3 text-sm flex items-center">
                                {order.fulfillment_status || "unfulfilled"}
                            </div>
                            <div className="h-11 rounded-xl bg-white/10 border border-white/10 text-white px-3 text-sm flex items-center">
                                {order.tracking_company || "Tracking platform not set"}
                            </div>
                            <div className="h-11 rounded-xl bg-white/10 border border-white/10 text-white px-3 text-sm flex items-center">
                                {order.tracking_number || "Tracking number not set"}
                            </div>
                            <div className="h-11 rounded-xl bg-white/10 border border-white/10 text-white px-3 text-sm flex items-center truncate">
                                {order.tracking_url || "Tracking URL not set"}
                            </div>
                        </div>
                        {order.pending_vendor_sync && (
                            <p className="text-xs text-yellow-300 mt-3">Supplier update is syncing to Shopify...</p>
                        )}
                        {order.last_shopify_sync_error && (
                            <p className="text-xs text-red-300 mt-2">{order.last_shopify_sync_error}</p>
                        )}
                        {(order.fulfillment_status === "on_hold" || order.hold_reason_label) && (
                            <div
                                className={`mt-4 rounded-xl border p-4 space-y-2 ${
                                    isLight
                                        ? "border-amber-300 bg-amber-50"
                                        : "border-amber-500/30 bg-amber-500/10"
                                }`}
                            >
                                <p
                                    className={`text-xs font-bold uppercase tracking-wider ${
                                        isLight ? "text-amber-800" : "text-amber-200"
                                    }`}
                                >
                                    Supplier hold
                                </p>
                                {order.hold_reason_label ? (
                                    <p className={`text-sm font-semibold ${isLight ? "text-slate-900" : "text-white"}`}>
                                        {order.hold_reason_label}
                                    </p>
                                ) : null}
                                {order.hold_note?.trim() ? (
                                    <p
                                        className={`text-sm whitespace-pre-wrap ${
                                            isLight ? "text-amber-800/90" : "text-amber-100/90"
                                        }`}
                                    >
                                        {order.hold_note}
                                    </p>
                                ) : null}
                                {!order.hold_reason_label && !order.hold_note?.trim() ? (
                                    <p className="text-sm text-slate-400">Reason details not available.</p>
                                ) : null}
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Left Column - Customer & Shipping */}
                        <div className="lg:col-span-1 space-y-6 min-w-0">
                            {/* Customer — always shown; placeholder when nothing is linked */}
                            <div className="bg-white/5 rounded-xl p-5 border border-white/10">
                                <div className="flex items-center gap-2 text-slate-400 mb-4">
                                    <User className="w-4 h-4" />
                                    <span className="text-xs font-bold uppercase tracking-wider">Customer</span>
                                </div>
                                {!hasCustomerData ? (
                                    <p className="text-slate-400 text-sm font-medium tracking-wide">
                                        Customer: --
                                    </p>
                                ) : (
                                    <div className="space-y-3">
                                        <p className="text-white font-bold text-base">
                                            {customerDisplayName || "—"}
                                        </p>
                                        <div className="flex items-center gap-2 text-slate-300 text-sm">
                                            <Mail className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                                            <span className="break-all">
                                                {contactEmail ? contactEmail : "Email: --"}
                                            </span>
                                        </div>
                                        {order.customer?.phone ? (
                                            <div className="flex items-center gap-2 text-slate-300 text-sm">
                                                <Phone className="w-3.5 h-3.5 text-slate-500" />
                                                <span>{order.customer.phone}</span>
                                            </div>
                                        ) : null}
                                    </div>
                                )}
                            </div>

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

                        {/* Middle Column - Order Items */}
                        <div className="lg:col-span-2 min-w-0">
                            <div className="bg-white/5 rounded-xl p-5 border border-white/10 w-full">
                            <div className="flex items-center gap-2 text-slate-400 mb-5">
                                <Package className="w-4 h-4" />
                                <span className="text-xs font-bold uppercase tracking-wider">Order Items</span>
                            </div>
                            <div className="space-y-4">
                                {order.line_items.map((item) => (
                                    <div key={item.id} className="bg-white/5 rounded-lg p-4 border border-white/5">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1 min-w-0">
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
                </div>
            </div>
    )
}
