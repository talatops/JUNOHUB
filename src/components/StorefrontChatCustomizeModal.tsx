"use client"

import { useEffect, useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Loader2, Palette, Save, Upload, WandSparkles, X } from "lucide-react"

export type StorefrontChatCustomization = {
    storefrontChatName: string
    storefrontChatTagline: string
    storefrontChatBrandColor: string
    storefrontChatFontFamily: string
    storefrontChatLogoUrl: string
}

type Props = {
    isOpen: boolean
    storeName: string
    initialValues: StorefrontChatCustomization
    onClose: () => void
    onSave: (payload: StorefrontChatCustomization) => Promise<void>
    onInject: () => Promise<void>
}

const FONT_OPTIONS = [
    { label: "System UI", value: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif" },
    { label: "Inter", value: "Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif" },
    { label: "Poppins", value: "Poppins, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif" },
    { label: "Montserrat", value: "Montserrat, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif" },
    { label: "Nunito", value: "Nunito, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif" },
]

export default function StorefrontChatCustomizeModal({
    isOpen,
    storeName,
    initialValues,
    onClose,
    onSave,
    onInject,
}: Props) {
    const [form, setForm] = useState<StorefrontChatCustomization>(initialValues)
    const [saving, setSaving] = useState(false)
    const [injecting, setInjecting] = useState(false)
    const [uploadingLogo, setUploadingLogo] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [saved, setSaved] = useState(false)

    useEffect(() => {
        if (!isOpen) return
        setForm(initialValues)
        setSaving(false)
        setInjecting(false)
        setUploadingLogo(false)
        setError(null)
        setSaved(false)
    }, [isOpen, initialValues])

    const canInject = useMemo(() => !saving && !injecting, [saving, injecting])

    const update = (key: keyof StorefrontChatCustomization, value: string) => {
        setForm((prev) => ({ ...prev, [key]: value }))
        setSaved(false)
    }

    const handleLogoUpload = async (file: File | null) => {
        if (!file) return
        setUploadingLogo(true)
        setError(null)
        try {
            const formData = new FormData()
            formData.append("file", file)
            const res = await fetch("/api/uploads/storefront-chat-logo", {
                method: "POST",
                body: formData,
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok || !data?.url) {
                throw new Error(data?.message || "Failed to upload logo")
            }
            update("storefrontChatLogoUrl", String(data.url))
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to upload logo")
        } finally {
            setUploadingLogo(false)
        }
    }

    const handleSave = async () => {
        setSaving(true)
        setError(null)
        try {
            await onSave(form)
            setSaved(true)
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to save customization")
        } finally {
            setSaving(false)
        }
    }

    const handleInject = async () => {
        setInjecting(true)
        setError(null)
        try {
            if (!saved) {
                await onSave(form)
                setSaved(true)
            }
            await onInject()
            onClose()
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to inject storefront chat")
        } finally {
            setInjecting(false)
        }
    }

    return (
        <AnimatePresence>
            {isOpen ? (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
                        onClick={onClose}
                    />
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0, y: 12, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 12, scale: 0.98 }}
                            className="w-full max-w-2xl rounded-2xl border border-white/10 bg-slate-900 shadow-2xl overflow-hidden"
                        >
                            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
                                <div className="min-w-0">
                                    <p className="text-white font-black text-lg">Customize Storefront Chat</p>
                                    <p className="text-xs text-slate-400 truncate">{storeName}</p>
                                </div>
                                <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/15 text-slate-300 flex items-center justify-center">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="p-5 grid md:grid-cols-2 gap-4">
                                <label className="block">
                                    <span className="text-xs font-bold text-slate-300">Chat Name</span>
                                    <input
                                        value={form.storefrontChatName}
                                        onChange={(e) => update("storefrontChatName", e.target.value)}
                                        className="mt-1 w-full h-10 rounded-xl bg-white/5 border border-white/10 px-3 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500/30"
                                    />
                                </label>

                                <label className="block">
                                    <span className="text-xs font-bold text-slate-300">Tagline</span>
                                    <input
                                        value={form.storefrontChatTagline}
                                        onChange={(e) => update("storefrontChatTagline", e.target.value)}
                                        className="mt-1 w-full h-10 rounded-xl bg-white/5 border border-white/10 px-3 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500/30"
                                    />
                                </label>

                                <label className="block">
                                    <span className="text-xs font-bold text-slate-300">Brand Color</span>
                                    <div className="mt-1 flex gap-2">
                                        <input
                                            type="color"
                                            value={form.storefrontChatBrandColor}
                                            onChange={(e) => update("storefrontChatBrandColor", e.target.value)}
                                            className="w-12 h-10 rounded-lg bg-transparent border border-white/10"
                                        />
                                        <input
                                            value={form.storefrontChatBrandColor}
                                            onChange={(e) => update("storefrontChatBrandColor", e.target.value)}
                                            className="flex-1 h-10 rounded-xl bg-white/5 border border-white/10 px-3 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500/30"
                                        />
                                    </div>
                                </label>

                                <label className="block">
                                    <span className="text-xs font-bold text-slate-300">Font</span>
                                    <select
                                        value={form.storefrontChatFontFamily}
                                        onChange={(e) => update("storefrontChatFontFamily", e.target.value)}
                                        className="mt-1 w-full h-10 rounded-xl bg-white/5 border border-white/10 px-3 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500/30"
                                    >
                                        {FONT_OPTIONS.map((opt) => (
                                            <option key={opt.value} value={opt.value} className="text-slate-900">
                                                {opt.label}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <div className="block md:col-span-2">
                                    <span className="text-xs font-bold text-slate-300">Logo Image (optional)</span>
                                    <div className="mt-1 flex flex-wrap gap-2">
                                        <label className="h-10 px-3 rounded-xl bg-white/10 text-slate-200 hover:bg-white/15 border border-white/10 cursor-pointer font-bold text-sm inline-flex items-center gap-2">
                                            {uploadingLogo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                            Upload image
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0] ?? null
                                                    void handleLogoUpload(file)
                                                    e.currentTarget.value = ""
                                                }}
                                            />
                                        </label>
                                        <input
                                            value={form.storefrontChatLogoUrl}
                                            onChange={(e) => update("storefrontChatLogoUrl", e.target.value)}
                                            placeholder="Or paste logo URL"
                                            className="flex-1 min-w-[220px] h-10 rounded-xl bg-white/5 border border-white/10 px-3 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500/30"
                                        />
                                    </div>
                                    <p className="text-[11px] text-slate-500 mt-1">Supported: image files up to 3MB.</p>
                                </div>

                                <div className="md:col-span-2 rounded-xl border border-white/10 bg-white/5 p-3">
                                    <p className="text-[11px] font-bold text-slate-400 mb-2">Preview</p>
                                    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                                        <div className="h-12 border-b border-slate-200 flex items-center gap-2 px-3" style={{ fontFamily: form.storefrontChatFontFamily }}>
                                            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${form.storefrontChatBrandColor}22` }}>
                                                {form.storefrontChatLogoUrl ? (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img src={form.storefrontChatLogoUrl} alt="Logo preview" className="w-5 h-5 object-contain rounded" />
                                                ) : (
                                                    <Palette className="w-4 h-4" style={{ color: form.storefrontChatBrandColor }} />
                                                )}
                                            </div>
                                            <div>
                                                <p className="text-xs font-black text-slate-900">{form.storefrontChatName || "JUNO Chat"}</p>
                                                <p className="text-[10px] text-slate-500">{form.storefrontChatTagline || "Ask about products"}</p>
                                            </div>
                                        </div>
                                        <div className="h-16 px-3 py-2 text-xs text-slate-400">Customer chat opens here...</div>
                                    </div>
                                </div>
                            </div>

                            {error ? (
                                <div className="px-5 pb-2 text-xs text-red-300">{error}</div>
                            ) : null}

                            <div className="px-5 py-4 border-t border-white/10 flex items-center justify-end gap-2">
                                <button
                                    onClick={handleSave}
                                    disabled={saving || injecting}
                                    className="h-10 px-4 rounded-xl bg-white/10 text-slate-200 hover:bg-white/15 disabled:opacity-50 font-bold text-sm flex items-center gap-2"
                                >
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    Save
                                </button>
                                <button
                                    onClick={handleInject}
                                    disabled={!canInject}
                                    className="h-10 px-4 rounded-xl bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-50 font-bold text-sm flex items-center gap-2"
                                >
                                    {injecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <WandSparkles className="w-4 h-4" />}
                                    INJECT
                                </button>
                            </div>
                        </motion.div>
                    </div>
                </>
            ) : null}
        </AnimatePresence>
    )
}
