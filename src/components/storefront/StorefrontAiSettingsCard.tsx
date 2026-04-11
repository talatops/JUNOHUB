"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { Loader2 } from "lucide-react"

type Props = {
    storeId: string
    initialCategoryMetadetailsEnabled: boolean
    isLight?: boolean
}

export function StorefrontAiSettingsCard({
    storeId,
    initialCategoryMetadetailsEnabled,
    isLight = false,
}: Props) {
    const [enabled, setEnabled] = useState(initialCategoryMetadetailsEnabled)
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState<string | null>(null)

    async function save(next: boolean) {
        setSaving(true)
        setMessage(null)
        try {
            const res = await fetch(`/api/stores/${encodeURIComponent(storeId)}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ categoryMetadetailsEnabled: next }),
            })
            const j = (await res.json().catch(() => ({}))) as { message?: string }
            if (!res.ok) throw new Error(j.message || "Failed to save")
            setEnabled(next)
            setMessage("Saved.")
        } catch (e) {
            setMessage(e instanceof Error ? e.message : "Failed to save")
        } finally {
            setSaving(false)
        }
    }

    return (
        <div
            className={cn(
                "rounded-2xl border p-4",
                isLight
                    ? "border-slate-200 bg-white"
                    : "border-white/10 bg-white/5",
            )}
        >
            <p className="text-sm font-black text-white">L1 AI — catalog metafields</p>
            <p className="text-xs text-slate-400 mt-1">
                When enabled, the storefront assistant may use synced product/category metafields
                from Shopify for factual answers. When off, it falls back to your knowledge base
                only.
            </p>
            <label className="mt-3 flex items-center gap-2 cursor-pointer">
                <input
                    type="checkbox"
                    checked={enabled}
                    disabled={saving}
                    onChange={(e) => void save(e.target.checked)}
                    className="rounded border-slate-500"
                />
                <span className="text-sm text-slate-200">Use category / product metafields in AI</span>
                {saving ? <Loader2 className="w-4 h-4 animate-spin text-slate-400" /> : null}
            </label>
            {message ? (
                <p className="text-xs mt-2 text-slate-500">{message}</p>
            ) : null}
        </div>
    )
}
