"use client"

import { useState, useEffect, Suspense, useMemo, useCallback } from "react"
import { createPortal } from "react-dom"
import { useSearchParams } from "next/navigation"
import toast from "react-hot-toast"
import {
    Mail,
    CheckCircle2,
    Loader2,
    Settings,
    Palette,
    X,
    Save,
    RotateCcw,
    Upload,
} from "lucide-react"
import {
    buildGmailReplyDemoHtml,
    parseGmailReplyThemeJson,
    GMAIL_REPLY_FONT_OPTIONS,
    wrapGmailHtmlDocument,
    type ResolvedGmailReplyTheme,
} from "@/lib/gmail/emailReplyTheme"
import { useTheme } from "@/components/ThemeProvider"
import { cn, publicAssetUrlForUi } from "@/lib/utils"

function ColorField({
    label,
    value,
    onChange,
    isLight,
}: {
    label: string
    value: string
    onChange: (v: string) => void
    isLight: boolean
}) {
    const normalized = /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000"
    return (
        <label className="flex flex-col gap-1.5 text-left">
            <span
                className={cn(
                    "text-[11px] font-semibold uppercase tracking-wide",
                    isLight ? "text-slate-500" : "text-slate-500",
                )}
            >
                {label}
            </span>
            <div className="flex items-center gap-2">
                <input
                    type="color"
                    value={normalized}
                    onChange={(e) => onChange(e.target.value)}
                    className={cn(
                        "h-9 w-12 shrink-0 cursor-pointer rounded-lg border p-0.5",
                        isLight ? "border-slate-200 bg-white" : "border-white/20 bg-slate-900",
                    )}
                    aria-label={label}
                />
                <input
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className={cn(
                        "min-w-0 flex-1 rounded-lg border px-2.5 py-1.5 font-mono text-xs",
                        isLight
                            ? "border-slate-200 bg-white text-slate-900"
                            : "border-white/15 bg-white/5 text-slate-100",
                    )}
                    spellCheck={false}
                />
            </div>
        </label>
    )
}

function GmailConnectContent() {
    const { theme } = useTheme()
    const isLight = theme === "light"
    const searchParams = useSearchParams()
    const [isConnected, setIsConnected] = useState(false)
    const [connecting, setConnecting] = useState(false)
    const [loading, setLoading] = useState(true)
    const [gmailEmail, setGmailEmail] = useState<string | null>(null)

    const [mounted, setMounted] = useState(false)
    const [activeStoreId, setActiveStoreId] = useState<string | null>(null)
    const [storeLoading, setStoreLoading] = useState(true)
    const [businessName, setBusinessName] = useState("Your store")
    const [themeModalOpen, setThemeModalOpen] = useState(false)
    const [themeDraft, setThemeDraft] = useState<ResolvedGmailReplyTheme>(() => parseGmailReplyThemeJson(null))
    const [themeSaving, setThemeSaving] = useState(false)
    const [uploadingGmailLogo, setUploadingGmailLogo] = useState(false)

    const previewDoc = useMemo(() => {
        const fragment = buildGmailReplyDemoHtml(businessName, themeDraft)
        return wrapGmailHtmlDocument(fragment, themeDraft)
    }, [businessName, themeDraft])

    const loadStoreTheme = useCallback(async (storeId: string, signal?: AbortSignal) => {
        const res = await fetch(`/api/stores/${encodeURIComponent(storeId)}`, { signal })
        const raw = await res.json().catch(() => ({}))
        if (!res.ok) return
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) return
        const data = raw as Record<string, unknown>
        if (typeof data.businessName === "string" && data.businessName.trim()) {
            setBusinessName(data.businessName.trim())
        }
        // Only apply theme when the API included the field. If the key is missing (e.g. older
        // GET fallback), do not overwrite local state — avoids a stale GET wiping a just-saved theme.
        if (Object.prototype.hasOwnProperty.call(data, "gmailReplyTheme")) {
            setThemeDraft(parseGmailReplyThemeJson(data.gmailReplyTheme ?? null))
        }
    }, [])

    useEffect(() => {
        setMounted(true)
    }, [])

    useEffect(() => {
        let cancelled = false
        ;(async () => {
            try {
                const res = await fetch("/api/stores")
                if (!res.ok || cancelled) return
                const data = (await res.json()) as { stores?: { id: string; isActive: boolean }[] }
                const active = (data.stores || []).find((s) => s.isActive)
                if (!cancelled) setActiveStoreId(active?.id ?? null)
            } catch {
                if (!cancelled) setActiveStoreId(null)
            } finally {
                if (!cancelled) setStoreLoading(false)
            }
        })()
        return () => {
            cancelled = true
        }
    }, [])

    useEffect(() => {
        if (!activeStoreId) return
        const ac = new AbortController()
        ;(async () => {
            try {
                await loadStoreTheme(activeStoreId, ac.signal)
            } catch (e) {
                if (e instanceof Error && e.name === "AbortError") return
            }
        })()
        return () => ac.abort()
    }, [activeStoreId, loadStoreTheme])

    /** Reload theme from server when opening the modal so the form always matches persisted data. */
    useEffect(() => {
        if (!themeModalOpen || !activeStoreId) return
        const ac = new AbortController()
        ;(async () => {
            try {
                await loadStoreTheme(activeStoreId, ac.signal)
            } catch (e) {
                if (e instanceof Error && e.name === "AbortError") return
            }
        })()
        return () => ac.abort()
    }, [themeModalOpen, activeStoreId, loadStoreTheme])

    useEffect(() => {
        if (!themeModalOpen) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setThemeModalOpen(false)
        }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [themeModalOpen])

    useEffect(() => {
        if (themeModalOpen) {
            document.body.style.overflow = "hidden"
        } else {
            document.body.style.overflow = ""
        }
        return () => {
            document.body.style.overflow = ""
        }
    }, [themeModalOpen])

    useEffect(() => {
        const checkConnection = async () => {
            try {
                const res = await fetch("/api/integrations/gmail/status")
                if (res.ok) {
                    const data = await res.json()
                    setIsConnected(data.connected || false)
                    setGmailEmail(data.email || null)
                }
            } catch {
                // Silent fail
            } finally {
                setLoading(false)
            }
        }
        checkConnection()

        const connected = searchParams.get("connected")
        const error = searchParams.get("error")

        if (connected === "true") {
            setIsConnected(true)
            setLoading(false)
            toast.success("Gmail connected successfully!")
            checkConnection()
        }
        if (error) {
            const redirectUri = searchParams.get("redirect_uri")
            const errorMessages: Record<string, string> = {
                oauth_failed: "OAuth authorization failed",
                no_code: "Authorization code not received",
                token_exchange_failed: "Failed to exchange authorization code",
                user_info_failed: "Failed to fetch Gmail account info",
                callback_failed: "Connection callback failed",
                redirect_uri_mismatch: redirectUri
                    ? `Redirect URI mismatch. The redirect URI "${redirectUri}" must be added to your Google Cloud Console OAuth client. Go to Google Cloud Console > APIs & Services > Credentials > Your OAuth Client > Authorized redirect URIs and add this exact URI.`
                    : "Redirect URI mismatch. Please check your Google Cloud Console OAuth configuration.",
            }
            const errorMessage = errorMessages[error] || "Failed to connect Gmail. Please try again."
            toast.error(errorMessage, { duration: redirectUri ? 10000 : 5000 })
            setLoading(false)
        }
    }, [searchParams])

    const handleConnect = async () => {
        setConnecting(true)
        try {
            const res = await fetch("/api/integrations/gmail/connect", {
                method: "POST",
            })
            const data = await res.json()

            if (res.ok && data.authUrl) {
                window.location.href = data.authUrl
            } else {
                throw new Error(data.message || "Failed to initiate Gmail connection")
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Failed to connect Gmail"
            toast.error(errorMessage)
            setConnecting(false)
        }
    }

    const handleDisconnect = async () => {
        try {
            const res = await fetch("/api/integrations/gmail/disconnect", {
                method: "POST",
            })
            if (res.ok) {
                setIsConnected(false)
                setGmailEmail(null)
                toast.success("Gmail disconnected successfully")
            } else {
                const data = await res.json()
                throw new Error(data.message || "Failed to disconnect")
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Failed to disconnect Gmail"
            toast.error(errorMessage)
        }
    }

    async function saveGmailTheme() {
        if (!activeStoreId) {
            toast.error("No active store")
            return
        }
        setThemeSaving(true)
        try {
            const res = await fetch(`/api/stores/${encodeURIComponent(activeStoreId)}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ gmailReplyTheme: themeDraft }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                throw new Error(
                    typeof (data as { message?: string }).message === "string"
                        ? (data as { message: string }).message
                        : "Save failed",
                )
            }
            const patch = data as { gmailReplyTheme?: ResolvedGmailReplyTheme | null }
            if (patch.gmailReplyTheme !== undefined) {
                setThemeDraft(parseGmailReplyThemeJson(patch.gmailReplyTheme ?? null))
            }
            toast.success("Email appearance saved")
            setThemeModalOpen(false)
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Save failed")
        } finally {
            setThemeSaving(false)
        }
    }

    async function handleGmailLogoUpload(file: File | null) {
        if (!file || !activeStoreId) return
        setUploadingGmailLogo(true)
        try {
            const fd = new FormData()
            fd.append("file", file)
            fd.append("storeId", activeStoreId)
            const res = await fetch("/api/uploads/gmail-reply-logo", {
                method: "POST",
                body: fd,
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                throw new Error(typeof data.message === "string" ? data.message : "Upload failed")
            }
            if (typeof data.url !== "string") {
                throw new Error("Invalid upload response")
            }
            setThemeDraft((d) => ({ ...d, logoUrl: data.url }))
            toast.success("Logo uploaded")
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Upload failed")
        } finally {
            setUploadingGmailLogo(false)
        }
    }

    async function clearGmailTheme() {
        if (!activeStoreId) return
        setThemeSaving(true)
        try {
            const res = await fetch(`/api/stores/${encodeURIComponent(activeStoreId)}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ gmailReplyTheme: null }),
            })
            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                throw new Error(
                    typeof (data as { message?: string }).message === "string"
                        ? (data as { message: string }).message
                        : "Reset failed",
                )
            }
            setThemeDraft(parseGmailReplyThemeJson(null))
            toast.success("Restored default appearance")
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Reset failed")
        } finally {
            setThemeSaving(false)
        }
    }

    const themeModal =
        mounted &&
        themeModalOpen &&
        createPortal(
            <div
                className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
                role="dialog"
                aria-modal="true"
                aria-labelledby="gmail-theme-title"
            >
                <button
                    type="button"
                    className={cn(
                        "absolute inset-0 backdrop-blur-sm",
                        isLight ? "bg-slate-900/35" : "bg-slate-950/70",
                    )}
                    aria-label="Close"
                    onClick={() => setThemeModalOpen(false)}
                />
                <div
                    className={cn(
                        "relative z-[101] flex max-h-[min(92vh,880px)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border shadow-2xl",
                        isLight
                            ? "border-slate-200 bg-white shadow-slate-900/10"
                            : "border-white/10 bg-slate-900 shadow-black/40",
                    )}
                >
                    <div
                        className={cn(
                            "flex shrink-0 items-center justify-between gap-3 border-b px-5 py-4",
                            isLight ? "border-slate-200" : "border-white/10",
                        )}
                    >
                        <div className="min-w-0">
                            <h2
                                id="gmail-theme-title"
                                className={cn("text-lg font-bold", isLight ? "text-slate-900" : "text-white")}
                            >
                                Email appearance
                            </h2>
                            <p className={cn("mt-0.5 text-xs", isLight ? "text-slate-600" : "text-slate-400")}>
                                Colors, font, and logo apply to automated Gmail replies. Preview updates as you edit.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setThemeModalOpen(false)}
                            className={cn(
                                "rounded-xl p-2 transition",
                                isLight
                                    ? "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                                    : "text-slate-400 hover:bg-white/10 hover:text-white",
                            )}
                            aria-label="Close"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                    <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 lg:grid-cols-[minmax(280px,380px)_1fr]">
                        <div
                            className={cn(
                                "max-h-[min(92vh,880px)] overflow-y-auto border-b p-5 lg:border-b-0 lg:border-r",
                                isLight ? "border-slate-200 lg:border-slate-200" : "border-white/10 lg:border-white/10",
                            )}
                        >
                            <div className="space-y-4">
                                <div>
                                    <label
                                        className={cn(
                                            "text-[11px] font-semibold uppercase tracking-wide",
                                            isLight ? "text-slate-500" : "text-slate-500",
                                        )}
                                    >
                                        Logo image (optional)
                                    </label>
                                    <div className="mt-1.5 flex flex-wrap items-center gap-3">
                                        <label
                                            className={cn(
                                                "inline-flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition",
                                                isLight
                                                    ? "border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100"
                                                    : "border-white/15 bg-white/5 text-slate-200 hover:bg-white/10",
                                                (uploadingGmailLogo || !activeStoreId) && "pointer-events-none opacity-50",
                                            )}
                                        >
                                            {uploadingGmailLogo ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <Upload className="h-4 w-4" />
                                            )}
                                            Upload
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className="sr-only"
                                                disabled={uploadingGmailLogo || !activeStoreId}
                                                onChange={(e) => {
                                                    const f = e.target.files?.[0]
                                                    void handleGmailLogoUpload(f ?? null)
                                                    e.target.value = ""
                                                }}
                                            />
                                        </label>
                                        {themeDraft.logoUrl ? (
                                            <>
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img
                                                    src={publicAssetUrlForUi(themeDraft.logoUrl)}
                                                    alt=""
                                                    className="h-10 max-w-[140px] rounded object-contain"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setThemeDraft((d) => ({ ...d, logoUrl: null }))}
                                                    className={cn(
                                                        "text-xs font-bold underline",
                                                        isLight ? "text-slate-600" : "text-slate-400",
                                                    )}
                                                >
                                                    Remove
                                                </button>
                                            </>
                                        ) : null}
                                    </div>
                                    <p
                                        className={cn("mt-1 text-[11px]", isLight ? "text-slate-500" : "text-slate-500")}
                                    >
                                        PNG, JPG, or WebP (max 2MB). For the logo to show in real Gmail messages, set
                                        environment variable{" "}
                                        <code className="font-mono text-[10px]">NEXT_PUBLIC_APP_URL</code> to your
                                        public <code className="font-mono text-[10px]">https://</code> app URL (not
                                        localhost).
                                    </p>
                                </div>
                                <div>
                                    <label
                                        className={cn(
                                            "text-[11px] font-semibold uppercase tracking-wide",
                                            isLight ? "text-slate-500" : "text-slate-500",
                                        )}
                                    >
                                        Email signature (optional)
                                    </label>
                                    <textarea
                                        value={themeDraft.emailSignature}
                                        onChange={(e) =>
                                            setThemeDraft((d) => ({
                                                ...d,
                                                emailSignature: e.target.value.slice(0, 800),
                                            }))
                                        }
                                        rows={4}
                                        placeholder="Jane Doe, Support — Acme Co"
                                        className={cn(
                                            "mt-1.5 w-full resize-y rounded-xl border px-3 py-2 text-sm",
                                            isLight
                                                ? "border-slate-200 bg-white text-slate-900 placeholder:text-slate-400"
                                                : "border-white/15 bg-white/5 text-white placeholder:text-slate-500",
                                        )}
                                    />
                                    <p
                                        className={cn("mt-1 text-[11px]", isLight ? "text-slate-500" : "text-slate-500")}
                                    >
                                        Plain text only. When set, this <strong>replaces</strong> the default line
                                        &quot;— [store] Support (automated)&quot; on AI replies and replaces &quot;Best
                                        regards&quot; on fallback emails. Leave empty to keep the default sign-off.
                                    </p>
                                </div>
                                <div>
                                    <label
                                        className={cn(
                                            "text-[11px] font-semibold uppercase tracking-wide",
                                            isLight ? "text-slate-500" : "text-slate-500",
                                        )}
                                    >
                                        Font
                                    </label>
                                    <select
                                        value={themeDraft.fontFamily}
                                        onChange={(e) =>
                                            setThemeDraft((d) => ({ ...d, fontFamily: e.target.value }))
                                        }
                                        className={cn(
                                            "mt-1.5 w-full rounded-xl border px-3 py-2 text-sm",
                                            isLight
                                                ? "border-slate-200 bg-white text-slate-900"
                                                : "border-white/15 bg-white/5 text-white",
                                        )}
                                    >
                                        {GMAIL_REPLY_FONT_OPTIONS.map((o) => (
                                            <option
                                                key={o.value}
                                                value={o.value}
                                                className={isLight ? "bg-white text-slate-900" : "bg-slate-900 text-slate-100"}
                                            >
                                                {o.label}
                                            </option>
                                        ))}
                                    </select>
                                    <p
                                        className={cn("mt-1 text-[11px]", isLight ? "text-slate-500" : "text-slate-500")}
                                    >
                                        Inter, Poppins, Montserrat, and Nunito load via Google Fonts in clients that
                                        support it; Gmail and others may still fall back to similar system fonts.
                                    </p>
                                </div>
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    <ColorField
                                        isLight={isLight}
                                        label="Page background"
                                        value={themeDraft.backgroundColor}
                                        onChange={(v) => setThemeDraft((d) => ({ ...d, backgroundColor: v }))}
                                    />
                                    <ColorField
                                        isLight={isLight}
                                        label="Card background"
                                        value={themeDraft.cardBackground}
                                        onChange={(v) => setThemeDraft((d) => ({ ...d, cardBackground: v }))}
                                    />
                                    <ColorField
                                        isLight={isLight}
                                        label="Card border"
                                        value={themeDraft.borderColor}
                                        onChange={(v) => setThemeDraft((d) => ({ ...d, borderColor: v }))}
                                    />
                                    <ColorField
                                        isLight={isLight}
                                        label="Heading text"
                                        value={themeDraft.headingColor}
                                        onChange={(v) => setThemeDraft((d) => ({ ...d, headingColor: v }))}
                                    />
                                    <ColorField
                                        isLight={isLight}
                                        label="Muted text"
                                        value={themeDraft.mutedColor}
                                        onChange={(v) => setThemeDraft((d) => ({ ...d, mutedColor: v }))}
                                    />
                                    <ColorField
                                        isLight={isLight}
                                        label="Body / quote text"
                                        value={themeDraft.textColor}
                                        onChange={(v) => setThemeDraft((d) => ({ ...d, textColor: v }))}
                                    />
                                    <ColorField
                                        isLight={isLight}
                                        label="Quote border"
                                        value={themeDraft.blockquoteBorder}
                                        onChange={(v) => setThemeDraft((d) => ({ ...d, blockquoteBorder: v }))}
                                    />
                                    <ColorField
                                        isLight={isLight}
                                        label="Quote background"
                                        value={themeDraft.blockquoteBg}
                                        onChange={(v) => setThemeDraft((d) => ({ ...d, blockquoteBg: v }))}
                                    />
                                    <ColorField
                                        isLight={isLight}
                                        label="Strong emphasis"
                                        value={themeDraft.strongColor}
                                        onChange={(v) => setThemeDraft((d) => ({ ...d, strongColor: v }))}
                                    />
                                    <ColorField
                                        isLight={isLight}
                                        label="Signature accent"
                                        value={themeDraft.signatureAccent}
                                        onChange={(v) => setThemeDraft((d) => ({ ...d, signatureAccent: v }))}
                                    />
                                </div>
                            </div>
                            <div className="mt-6 flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() => setThemeDraft(parseGmailReplyThemeJson(null))}
                                    disabled={themeSaving}
                                    className={cn(
                                        "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold disabled:opacity-50",
                                        isLight
                                            ? "border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100"
                                            : "border-white/15 bg-white/5 text-slate-200 hover:bg-white/10",
                                    )}
                                >
                                    <RotateCcw className="h-3.5 w-3.5" />
                                    Revert form
                                </button>
                                <button
                                    type="button"
                                    onClick={() => void clearGmailTheme()}
                                    disabled={themeSaving}
                                    className={cn(
                                        "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold disabled:opacity-50",
                                        isLight
                                            ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                                            : "border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20",
                                    )}
                                >
                                    Clear saved theme
                                </button>
                            </div>
                        </div>
                        <div
                            className={cn(
                                "flex min-h-[320px] flex-col p-4 lg:min-h-0",
                                isLight ? "bg-slate-50" : "bg-slate-950/50",
                            )}
                        >
                            <p
                                className={cn(
                                    "mb-2 text-[11px] font-semibold uppercase tracking-wide",
                                    isLight ? "text-slate-500" : "text-slate-500",
                                )}
                            >
                                Preview (sample reply)
                            </p>
                            <div
                                className={cn(
                                    "min-h-0 flex-1 overflow-hidden rounded-xl border shadow-inner",
                                    isLight ? "border-slate-200 bg-white" : "border-white/10 bg-slate-950",
                                )}
                            >
                                <iframe
                                    title="Gmail reply preview"
                                    className="h-full min-h-[280px] w-full border-0"
                                    srcDoc={previewDoc}
                                    sandbox="allow-same-origin"
                                />
                            </div>
                        </div>
                    </div>
                    <div
                        className={cn(
                            "flex shrink-0 flex-wrap items-center justify-end gap-2 border-t px-5 py-4",
                            isLight ? "border-slate-200" : "border-white/10",
                        )}
                    >
                        <button
                            type="button"
                            onClick={() => setThemeModalOpen(false)}
                            className={cn(
                                "rounded-xl px-4 py-2 text-sm font-bold",
                                isLight
                                    ? "text-slate-600 hover:bg-slate-100"
                                    : "text-slate-300 hover:bg-white/10",
                            )}
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={() => void saveGmailTheme()}
                            disabled={themeSaving || !activeStoreId}
                            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white shadow-md shadow-indigo-900/15 hover:bg-indigo-700 disabled:opacity-50"
                        >
                            {themeSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            Save
                        </button>
                    </div>
                </div>
            </div>,
            document.body,
        )

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center">
                <Loader2
                    className={cn("w-8 h-8 animate-spin", isLight ? "text-indigo-600" : "text-indigo-400")}
                />
            </div>
        )
    }

    return (
        <div className="h-full flex flex-col space-y-4 md:space-y-6">
            {themeModal}
            <div
                className={cn(
                    "backdrop-blur-xl rounded-xl md:rounded-2xl border overflow-hidden p-6 md:p-8",
                    isLight
                        ? "border-slate-200 bg-white shadow-sm shadow-slate-900/5"
                        : "border-white/10 bg-white/5",
                )}
            >
                <div className="flex flex-col items-center text-center space-y-6">
                    <div
                        className={cn(
                            "w-20 h-20 rounded-2xl flex items-center justify-center border-2",
                            isConnected
                                ? isLight
                                    ? "bg-emerald-50 border-emerald-300 text-emerald-600"
                                    : "bg-emerald-500/20 border-emerald-500/50 text-emerald-400"
                                : isLight
                                  ? "bg-slate-100 border-slate-200 text-slate-500"
                                  : "bg-white/10 border-white/20 text-slate-400",
                        )}
                    >
                        <Mail className="w-10 h-10" />
                    </div>

                    <div className="space-y-2">
                        <h2
                            className={cn(
                                "text-2xl font-extrabold",
                                isLight ? "text-slate-900" : "text-white",
                            )}
                        >
                            {isConnected ? "Gmail Connected" : "Connect Your Gmail Account"}
                        </h2>
                        <p
                            className={cn("text-sm max-w-md", isLight ? "text-slate-600" : "text-slate-400")}
                        >
                            {isConnected
                                ? "Your Gmail account is connected and ready to sync emails."
                                : "Connect your Gmail account to enable email syncing, ticket creation, and automated responses."}
                        </p>
                    </div>

                    <div className="w-full max-w-md">
                        <button
                            type="button"
                            onClick={() => setThemeModalOpen(true)}
                            disabled={storeLoading || !activeStoreId}
                            className={cn(
                                "flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold shadow-md transition disabled:cursor-not-allowed disabled:opacity-40",
                                isLight
                                    ? "border-2 border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-700 hover:border-indigo-700"
                                    : "border border-indigo-400/40 bg-indigo-500 text-white hover:bg-indigo-400",
                            )}
                        >
                            {storeLoading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Palette className="h-4 w-4" />
                            )}
                            Customize email appearance
                        </button>
                        {!activeStoreId && !storeLoading && (
                            <p
                                className={cn(
                                    "mt-2 text-center text-xs",
                                    isLight ? "text-slate-500" : "text-slate-500",
                                )}
                            >
                                Select a store in your account to edit appearance.
                            </p>
                        )}
                    </div>

                    {isConnected ? (
                        <div className="w-full max-w-md space-y-4">
                            <div
                                className={cn(
                                    "rounded-xl p-4 flex items-center gap-3 border",
                                    isLight
                                        ? "bg-emerald-50/90 border-emerald-200"
                                        : "bg-emerald-500/10 border-emerald-500/20",
                                )}
                            >
                                <CheckCircle2
                                    className={cn(
                                        "w-5 h-5 shrink-0",
                                        isLight ? "text-emerald-600" : "text-emerald-400",
                                    )}
                                />
                                <div className="flex-1 text-left">
                                    <p
                                        className={cn(
                                            "text-sm font-bold",
                                            isLight ? "text-emerald-800" : "text-emerald-400",
                                        )}
                                    >
                                        Connection Active
                                    </p>
                                    <p
                                        className={cn("text-xs mt-1", isLight ? "text-slate-600" : "text-slate-400")}
                                    >
                                        {gmailEmail ? `Connected to ${gmailEmail}` : "Emails are being synced automatically"}
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={async () => {
                                        try {
                                            const res = await fetch("/api/integrations/gmail/poll", {
                                                method: "POST",
                                            })
                                            const data = await res.json()
                                            if (res.ok) {
                                                toast.success(`Processed ${data.processed} email(s)`)
                                            } else {
                                                toast.error("Failed to check emails")
                                            }
                                        } catch {
                                            toast.error("Error checking emails")
                                        }
                                    }}
                                    className={cn(
                                        "flex-1 h-11 px-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-sm border",
                                        isLight
                                            ? "border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100"
                                            : "bg-white/10 border-white/10 text-white hover:bg-white/15",
                                    )}
                                >
                                    <Settings className="w-4 h-4" />
                                    Check Emails
                                </button>
                                <button
                                    onClick={handleDisconnect}
                                    className={cn(
                                        "flex-1 h-11 px-4 rounded-xl font-bold transition-all text-sm border",
                                        isLight
                                            ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                                            : "bg-red-500/20 border-red-500/30 text-red-400 hover:bg-red-500/30",
                                    )}
                                >
                                    Disconnect
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="w-full max-w-md space-y-4">
                            <div
                                className={cn(
                                    "rounded-xl p-5 space-y-5 border",
                                    isLight
                                        ? "border-slate-200 bg-slate-50/90"
                                        : "border-white/10 bg-white/5",
                                )}
                            >
                                {(
                                    [
                                        {
                                            title: "Email Sync",
                                            desc: "Automatically sync incoming emails",
                                        },
                                        {
                                            title: "Ticket Creation",
                                            desc: "Create support tickets from emails",
                                        },
                                        {
                                            title: "Auto Responses",
                                            desc: "Send automated replies using L1 AI and your knowledge base (configure under JUNO Engine → Modules)",
                                        },
                                    ] as const
                                ).map((row) => (
                                    <div
                                        key={row.title}
                                        className="flex flex-col items-center text-center gap-2 max-w-sm mx-auto"
                                    >
                                        <CheckCircle2
                                            className={cn(
                                                "w-6 h-6 shrink-0",
                                                isLight ? "text-emerald-600" : "text-emerald-400",
                                            )}
                                            aria-hidden
                                        />
                                        <div>
                                            <p
                                                className={cn(
                                                    "text-sm font-bold",
                                                    isLight ? "text-slate-900" : "text-white",
                                                )}
                                            >
                                                {row.title}
                                            </p>
                                            <p
                                                className={cn(
                                                    "text-xs mt-1 leading-relaxed",
                                                    isLight ? "text-slate-600" : "text-slate-400",
                                                )}
                                            >
                                                {row.desc}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <button
                                onClick={handleConnect}
                                disabled={connecting}
                                className="w-full h-12 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 border-2 border-indigo-600 hover:border-indigo-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-indigo-900/10"
                            >
                                {connecting ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Connecting...
                                    </>
                                ) : (
                                    <>
                                        <Mail className="w-5 h-5" />
                                        Connect Gmail Account
                                    </>
                                )}
                            </button>

                            <p
                                className={cn(
                                    "text-xs text-center",
                                    isLight ? "text-slate-500" : "text-slate-500",
                                )}
                            >
                                By connecting, you authorize JUNO to access your Gmail account for email management purposes.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default function GmailConnectPage() {
    return (
        <Suspense
            fallback={
                <div className="h-full flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
                </div>
            }
        >
            <GmailConnectContent />
        </Suspense>
    )
}
