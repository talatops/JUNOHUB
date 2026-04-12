"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import toast from "react-hot-toast"
import { BellRing, CheckCircle2, Loader2, Package, Warehouse } from "lucide-react"

function parseThresholdDraft(trimmed: string): { ok: true; value: number | null } | { ok: false } {
    if (trimmed === "") return { ok: true, value: null }
    const n = Number.parseInt(trimmed, 10)
    if (!Number.isFinite(n) || n < 0 || n > 1_000_000) return { ok: false }
    return { ok: true, value: n }
}

export default function LowStockSettingsPage() {
    const [activeStoreId, setActiveStoreId] = useState<string | null>(null)
    const [shopifyDraft, setShopifyDraft] = useState("")
    const [supplierDraft, setSupplierDraft] = useState("")
    const [saving, setSaving] = useState(false)
    const [savedFlash, setSavedFlash] = useState(false)
    const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const loadStore = useCallback(async () => {
        try {
            const res = await fetch("/api/stores")
            if (!res.ok) return
            const data = await res.json()
            const active = data.stores?.find((s: { isActive: boolean }) => s.isActive) as
                | { id?: string }
                | undefined
            if (!active?.id) {
                setActiveStoreId(null)
                return
            }
            setActiveStoreId(active.id)
            const settingsRes = await fetch(`/api/stores/${active.id}`, { cache: "no-store" })
            if (!settingsRes.ok) return
            const s = (await settingsRes.json()) as {
                lowStockThreshold?: number | null
                lowStockShopifyThreshold?: number | null
            }
            setShopifyDraft(
                typeof s.lowStockShopifyThreshold === "number" ? String(s.lowStockShopifyThreshold) : "",
            )
            setSupplierDraft(typeof s.lowStockThreshold === "number" ? String(s.lowStockThreshold) : "")
        } catch {
            // ignore
        }
    }, [])

    useEffect(() => {
        void loadStore()
    }, [loadStore])

    useEffect(() => {
        return () => {
            if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
        }
    }, [])

    const save = async () => {
        if (!activeStoreId) {
            toast.error("No active store")
            return
        }
        const shopifyTrim = shopifyDraft.trim()
        const supplierTrim = supplierDraft.trim()
        const shopifyParsed = parseThresholdDraft(shopifyTrim)
        const supplierParsed = parseThresholdDraft(supplierTrim)
        if (!shopifyParsed.ok || !supplierParsed.ok) {
            toast.error("Enter whole numbers from 0 to 1000000, or leave empty to turn off.")
            return
        }
        const payload = {
            lowStockShopifyThreshold: shopifyParsed.value,
            lowStockThreshold: supplierParsed.value,
        }
        setSaving(true)
        try {
            const res = await fetch(`/api/stores/${activeStoreId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            })
            const data = (await res.json().catch(() => ({}))) as {
                message?: string
                lowStockReconcileQueued?: boolean
            }
            if (!res.ok) throw new Error(data.message || "Save failed")
            if (flashTimerRef.current) {
                clearTimeout(flashTimerRef.current)
                flashTimerRef.current = null
            }
            setSavedFlash(true)
            flashTimerRef.current = setTimeout(() => {
                setSavedFlash(false)
                flashTimerRef.current = null
            }, 2800)
            const anyOn = payload.lowStockThreshold !== null || payload.lowStockShopifyThreshold !== null
            if (!anyOn) {
                toast.success("Low-stock alert thresholds turned off.")
            } else if (data.lowStockReconcileQueued) {
                toast.success(
                    "Saved. Scanning products for low stock (supplier chat and Shopify notifications where applicable).",
                )
            } else {
                toast.success("Thresholds saved.")
            }
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Could not save")
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-bold text-white">Low-stock alerts</h2>
                <p className="text-sm text-slate-400 mt-1">
                    Optional thresholds for your active store. Empty means off. When Shopify total stock falls below
                    your Shopify threshold, you get an in-app notification. When supplier-reported stock falls below the
                    supplier threshold, linked suppliers get a JUNO chat product card (existing behavior).
                </p>
            </div>

            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <label className="flex items-center gap-2 text-sm font-bold text-slate-400 mb-2">
                    <Package className="w-4 h-4" />
                    Shopify stock (on-hand)
                </label>
                <p className="text-xs text-slate-500 mb-3">
                    Sum of variant <code className="text-slate-400">inventory_quantity</code> for the product (from
                    webhooks / cache). If it drops below this number, you receive a notification in the bell menu—restock
                    or use Load stock in Inventory.
                </p>
                <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Off"
                    value={shopifyDraft}
                    onChange={(e) => setShopifyDraft(e.target.value.replace(/[^\d]/g, ""))}
                    className="w-full max-w-xs px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-slate-500 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50"
                />
            </div>

            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <label className="flex items-center gap-2 text-sm font-bold text-slate-400 mb-2">
                    <Warehouse className="w-4 h-4" />
                    Supplier-reported stock
                </label>
                <p className="text-xs text-slate-500 mb-3">
                    Matches the Supplier stock column on Inventory (ACCEPTED sync snapshot). When set, linked suppliers
                    can get a product card in JUNO chat if reported quantity is below this value.
                </p>
                <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Off"
                    value={supplierDraft}
                    onChange={(e) => setSupplierDraft(e.target.value.replace(/[^\d]/g, ""))}
                    className="w-full max-w-xs px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-slate-500 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50"
                />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <button
                    type="button"
                    disabled={saving || !activeStoreId}
                    onClick={() => void save()}
                    className={`h-10 px-5 rounded-xl font-bold text-sm text-white disabled:opacity-50 transition-colors flex items-center justify-center gap-2 min-w-[6rem] ${
                        savedFlash && !saving ? "bg-emerald-600 hover:bg-emerald-500" : "bg-indigo-600 hover:bg-indigo-500"
                    }`}
                >
                    {saving ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden />
                            Saving…
                        </>
                    ) : savedFlash ? (
                        <>
                            <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden />
                            Saved
                        </>
                    ) : (
                        "Save thresholds"
                    )}
                </button>
                <div className="flex items-start gap-2 text-xs text-slate-500 max-w-lg">
                    <BellRing className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" aria-hidden />
                    <span>
                        Values are stored on your store and persist across sessions. &quot;Saved&quot; is brief
                        confirmation only—you do not need to save again for future alerts.
                    </span>
                </div>
            </div>
        </div>
    )
}
