"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Loader2, AlertCircle, Package, Truck, Save, CheckCircle2, User, Mail, Phone, MapPin, X } from "lucide-react"
import toast from "react-hot-toast"
import { useTheme } from "@/components/ThemeProvider"
import {
    SUPPLIER_HOLD_REASON_OPTIONS,
    type SupplierHoldReasonCode,
} from "@/lib/orders/supplierHoldReasons"

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
    holdReasonCode?: string | null
    holdNote?: string | null
    holdReasonLabel?: string | null
}

export default function SupplierOrderDetailsPage() {
    const router = useRouter()
    const params = useParams()
    const orderId = params?.orderId as string
    const { theme } = useTheme()
    const isLight = theme === "light"

    const [order, setOrder] = useState<SupplierOrder | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState("")

    const [fulfillmentStatus, setFulfillmentStatus] = useState("UNFULFILLED")
    const [trackingNumber, setTrackingNumber] = useState("")
    const [trackingCompany, setTrackingCompany] = useState("")
    const [trackingUrl, setTrackingUrl] = useState("")
    const [holdReasonCode, setHoldReasonCode] = useState<SupplierHoldReasonCode | "">("")
    const [holdNote, setHoldNote] = useState("")
    const [holdModalOpen, setHoldModalOpen] = useState(false)
    const [statusBeforeHoldModal, setStatusBeforeHoldModal] = useState<string | null>(null)
    const [modalReason, setModalReason] = useState<SupplierHoldReasonCode | "">("")
    const [modalNote, setModalNote] = useState("")

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
                const hc = o.holdReasonCode
                setHoldReasonCode(
                    hc === "inventory_out_of_stock" ||
                        hc === "address_incorrect" ||
                        hc === "high_risk_fraud" ||
                        hc === "awaiting_payment" ||
                        hc === "other"
                        ? hc
                        : "",
                )
                setHoldNote(o.holdNote || "")
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
        const origHold =
            order.holdReasonCode === "inventory_out_of_stock" ||
            order.holdReasonCode === "address_incorrect" ||
            order.holdReasonCode === "high_risk_fraud" ||
            order.holdReasonCode === "awaiting_payment" ||
            order.holdReasonCode === "other"
                ? order.holdReasonCode
                : ""
        return (
            fulfillmentStatus !== (order.fulfillmentStatus || "UNFULFILLED") ||
            trackingNumber !== (order.trackingNumber || "") ||
            trackingCompany !== (order.trackingCompany || "") ||
            trackingUrl !== (order.trackingUrl || "") ||
            holdReasonCode !== origHold ||
            holdNote !== (order.holdNote || "")
        )
    }, [order, fulfillmentStatus, trackingNumber, trackingCompany, trackingUrl, holdReasonCode, holdNote])

    const trackingLocked = fulfillmentStatus === "ON_HOLD"
    const holdIncomplete = fulfillmentStatus === "ON_HOLD" && !holdReasonCode
    const canSave = changed && !holdIncomplete && !holdModalOpen

    const openHoldModal = (revertTo: string) => {
        setStatusBeforeHoldModal(revertTo)
        setModalReason(holdReasonCode || "")
        setModalNote(holdReasonCode === "other" ? holdNote : "")
        setHoldModalOpen(true)
    }

    const confirmHoldModal = () => {
        if (!modalReason) {
            toast.error("Select a hold reason")
            return
        }
        if (modalReason === "other" && !modalNote.trim()) {
            toast.error("Enter a note for Other")
            return
        }
        setHoldReasonCode(modalReason)
        setHoldNote(modalReason === "other" ? modalNote.trim() : "")
        setFulfillmentStatus("ON_HOLD")
        setHoldModalOpen(false)
        setStatusBeforeHoldModal(null)
    }

    const cancelHoldModal = () => {
        setHoldModalOpen(false)
        if (statusBeforeHoldModal !== null) {
            setFulfillmentStatus(statusBeforeHoldModal)
            setStatusBeforeHoldModal(null)
        }
    }

    const onStatusChange = (value: string) => {
        if (value === "ON_HOLD") {
            const prev = fulfillmentStatus
            setFulfillmentStatus("ON_HOLD")
            openHoldModal(prev)
            return
        }
        setFulfillmentStatus(value)
        setHoldReasonCode("")
        setHoldNote("")
    }

    const save = async () => {
        if (!order || holdIncomplete) return
        setSaving(true)
        try {
            const res = await fetch(`/api/supplier/orders/${order.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    fulfillmentStatus,
                    trackingNumber: trackingLocked ? null : trackingNumber || null,
                    trackingCompany: trackingLocked ? null : trackingCompany || null,
                    trackingUrl: trackingLocked ? null : trackingUrl || null,
                    holdReasonCode: fulfillmentStatus === "ON_HOLD" ? holdReasonCode : null,
                    holdNote:
                        fulfillmentStatus === "ON_HOLD" && holdReasonCode === "other"
                            ? holdNote.trim()
                            : fulfillmentStatus === "ON_HOLD"
                              ? null
                              : null,
                }),
            })
            const data = (await res.json().catch(() => ({}))) as {
                message?: string
                order?: SupplierOrder & { fulfillmentStatusDisplay?: string }
            }
            if (!res.ok) throw new Error(data.message || "Failed to save")
            toast.success("Order updated successfully")
            const next = data.order
            setOrder({
                ...order,
                fulfillmentStatus: next?.fulfillmentStatus ?? fulfillmentStatus,
                trackingNumber: trackingLocked ? null : trackingNumber,
                trackingCompany: trackingLocked ? null : trackingCompany,
                trackingUrl: trackingLocked ? null : trackingUrl,
                holdReasonCode: fulfillmentStatus === "ON_HOLD" ? holdReasonCode : null,
                holdNote:
                    fulfillmentStatus === "ON_HOLD" && holdReasonCode === "other"
                        ? holdNote.trim()
                        : fulfillmentStatus === "ON_HOLD"
                          ? null
                          : null,
                holdReasonLabel: next?.holdReasonLabel ?? order.holdReasonLabel,
            })
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Failed to update order")
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
                    disabled={!canSave || saving}
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
                            onChange={(e) => onStatusChange(e.target.value)}
                            className="w-full h-11 rounded-xl bg-white/10 border border-white/10 text-white px-3"
                        >
                            <option value="UNFULFILLED">Unfulfilled</option>
                            <option value="IN_PROGRESS">In Progress</option>
                            <option value="ON_HOLD">On hold</option>
                            <option value="SHIPPED">Shipped</option>
                            <option value="FULFILLED">Fulfilled</option>
                            <option value="CANCELLED">Cancelled</option>
                        </select>
                    </div>

                    {fulfillmentStatus === "ON_HOLD" && holdReasonCode ? (
                        <div
                            className={`rounded-xl border p-3 space-y-1 ${
                                isLight
                                    ? "border-amber-300 bg-amber-50"
                                    : "border-amber-500/35 bg-amber-500/10"
                            }`}
                        >
                            <p
                                className={`text-[11px] font-bold uppercase ${
                                    isLight ? "text-amber-800" : "text-amber-200"
                                }`}
                            >
                                Hold reason
                            </p>
                            <p className={`text-sm font-semibold ${isLight ? "text-slate-900" : "text-white"}`}>
                                {SUPPLIER_HOLD_REASON_OPTIONS.find((o) => o.value === holdReasonCode)?.label ||
                                    holdReasonCode}
                            </p>
                            {holdReasonCode === "other" && holdNote.trim() ? (
                                <p
                                    className={`text-xs whitespace-pre-wrap ${
                                        isLight ? "text-amber-800/90" : "text-amber-100/90"
                                    }`}
                                >
                                    {holdNote}
                                </p>
                            ) : null}
                            <button
                                type="button"
                                onClick={() => openHoldModal(fulfillmentStatus)}
                                className={`text-xs font-bold underline mt-1 ${
                                    isLight ? "text-amber-800" : "text-amber-200"
                                }`}
                            >
                                Change reason
                            </button>
                        </div>
                    ) : null}

                    <div>
                        <label className="block text-xs uppercase text-slate-400 font-bold mb-2">Tracking Platform</label>
                        <select
                            value={trackingCompany}
                            onChange={(e) => setTrackingCompany(e.target.value)}
                            disabled={trackingLocked}
                            className="w-full h-11 rounded-xl bg-white/10 border border-white/10 text-white px-3 disabled:opacity-40 disabled:cursor-not-allowed"
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
                            disabled={trackingLocked}
                            className="w-full h-11 rounded-xl bg-white/10 border border-white/10 text-white px-3 disabled:opacity-40 disabled:cursor-not-allowed"
                        />
                    </div>

                    <div>
                        <label className="block text-xs uppercase text-slate-400 font-bold mb-2">Tracking URL (optional)</label>
                        <input
                            value={trackingUrl}
                            onChange={(e) => setTrackingUrl(e.target.value)}
                            placeholder="https://..."
                            disabled={trackingLocked}
                            className="w-full h-11 rounded-xl bg-white/10 border border-white/10 text-white px-3 disabled:opacity-40 disabled:cursor-not-allowed"
                        />
                    </div>

                    {holdIncomplete && (
                        <p className={`text-xs font-semibold ${isLight ? "text-amber-800" : "text-amber-300"}`}>
                            Choose a hold reason (use On hold or Change reason).
                        </p>
                    )}

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
                        <p className="text-slate-300 flex items-center gap-2 break-all">
                            <Mail className="w-3.5 h-3.5 text-slate-500" />
                            {order.customer?.email || order.email || "Email: --"}
                        </p>
                        <p className="text-slate-300 flex items-center gap-2">
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

            {holdModalOpen ? (
                <div
                    className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${isLight ? "bg-slate-900/40 backdrop-blur-sm" : "bg-black/70"}`}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="hold-modal-title"
                >
                    <div
                        className={`w-full max-w-md rounded-2xl p-5 shadow-xl space-y-4 ${
                            isLight
                                ? "bg-white border border-slate-200"
                                : "border border-white/15 bg-slate-900"
                        }`}
                    >
                        <div className="flex items-start justify-between gap-2">
                            <h2
                                id="hold-modal-title"
                                className={`text-lg font-bold ${isLight ? "text-slate-900" : "text-white"}`}
                            >
                                On hold reason
                            </h2>
                            <button
                                type="button"
                                onClick={cancelHoldModal}
                                className={`p-1 rounded-lg ${
                                    isLight
                                        ? "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                                        : "text-slate-400 hover:bg-white/10 hover:text-white"
                                }`}
                                aria-label="Close"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <p className={`text-sm ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                            Select why this order is on hold. Required before you can save.
                        </p>
                        <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
                            {SUPPLIER_HOLD_REASON_OPTIONS.map((opt) => (
                                <label
                                    key={opt.value}
                                    className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer ${
                                        modalReason === opt.value
                                            ? isLight
                                                ? "border-indigo-500 bg-indigo-50"
                                                : "border-indigo-500/60 bg-indigo-500/15"
                                            : isLight
                                              ? "border-slate-200 bg-slate-50"
                                              : "border-white/10 bg-white/5"
                                    }`}
                                >
                                    <input
                                        type="radio"
                                        name="holdReason"
                                        className="mt-1"
                                        checked={modalReason === opt.value}
                                        onChange={() => setModalReason(opt.value)}
                                    />
                                    <span
                                        className={`text-sm font-medium ${isLight ? "text-slate-900" : "text-white"}`}
                                    >
                                        {opt.label}
                                    </span>
                                </label>
                            ))}
                        </div>
                        {modalReason === "other" ? (
                            <div>
                                <label
                                    className={`block text-xs uppercase font-bold mb-2 ${isLight ? "text-slate-500" : "text-slate-400"}`}
                                >
                                    Note
                                </label>
                                <textarea
                                    value={modalNote}
                                    onChange={(e) => setModalNote(e.target.value)}
                                    rows={3}
                                    maxLength={2000}
                                    placeholder="Describe the hold…"
                                    className={
                                        isLight
                                            ? "w-full rounded-xl bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 px-3 py-2 text-sm"
                                            : "w-full rounded-xl bg-white/10 border border-white/10 text-white px-3 py-2 text-sm"
                                    }
                                />
                            </div>
                        ) : null}
                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                type="button"
                                onClick={cancelHoldModal}
                                className={
                                    isLight
                                        ? "h-10 px-4 rounded-xl bg-slate-100 text-slate-800 font-semibold hover:bg-slate-200"
                                        : "h-10 px-4 rounded-xl bg-white/10 text-white font-semibold"
                                }
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={confirmHoldModal}
                                className="h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold"
                            >
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    )
}

