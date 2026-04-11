"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import {
    User,
    Mail,
    Building,
    Save,
    Loader2,
    CheckCircle2,
    AlertCircle,
    Bell,
    BellOff,
    KeyRound,
    ChevronDown,
} from "lucide-react"
import { usePushNotifications } from "@/hooks/usePushNotifications"
import { accountUpdateSchema, isStrongPassword } from "@/lib/validation"
import { cn } from "@/lib/utils"

type ActiveStoreMeta = {
    id: string
    businessName: string
    shopifyDomain: string
}

const SHOPIFY_TOKEN_MAX = 4000

export default function AccountSettingsPage() {
    const { data: session, update } = useSession()
    const { permission, isSubscribed, loading: pushLoading, subscribe, unsubscribe } = usePushNotifications()
    const [pushActionLoading, setPushActionLoading] = useState(false)
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState("")
    const [error, setError] = useState("")
    const [formData, setFormData] = useState({
        businessName: "",
        currentPassword: "",
        newPassword: "",
        confirmPassword: ""
    })

    const [activeStoreMeta, setActiveStoreMeta] = useState<ActiveStoreMeta | null>(null)
    const [shopifyTokenOpen, setShopifyTokenOpen] = useState(false)
    const [newShopifyToken, setNewShopifyToken] = useState("")
    const [tokenLoading, setTokenLoading] = useState(false)
    const [tokenSuccess, setTokenSuccess] = useState("")
    const [tokenError, setTokenError] = useState("")

    const refreshActiveStore = useCallback(async () => {
        try {
            const res = await fetch("/api/stores")
            if (!res.ok) return
            const data = await res.json()
            const activeStore = data.stores?.find((s: { isActive: boolean }) => s.isActive) as
                | {
                      id?: string
                      businessName?: string
                      shopifyDomain?: string
                      onboardingComplete?: boolean
                  }
                | undefined
            if (activeStore?.businessName) {
                setFormData((prev) => ({ ...prev, businessName: activeStore.businessName || "" }))
            } else if (session?.user?.name) {
                setFormData((prev) => ({ ...prev, businessName: session.user.name || "" }))
            }
            if (
                activeStore?.id &&
                activeStore.shopifyDomain &&
                activeStore.onboardingComplete
            ) {
                setActiveStoreMeta({
                    id: activeStore.id,
                    businessName: activeStore.businessName || "Store",
                    shopifyDomain: activeStore.shopifyDomain,
                })
            } else {
                setActiveStoreMeta(null)
            }
        } catch {
            // Silent fail
        }
    }, [session?.user?.name])

    useEffect(() => {
        void refreshActiveStore()
    }, [refreshActiveStore])

    const toggleShopifyTokenPanel = () => {
        const next = !shopifyTokenOpen
        setShopifyTokenOpen(next)
        setTokenError("")
        setTokenSuccess("")
        if (next) void refreshActiveStore()
    }

    const saveShopifyAccessToken = async () => {
        const trimmed = newShopifyToken.trim()
        if (!trimmed) {
            setTokenError("Paste your new Admin API access token.")
            return
        }
        if (!activeStoreMeta) {
            setTokenError("No connected Shopify store found for your active store.")
            return
        }
        setTokenLoading(true)
        setTokenError("")
        setTokenSuccess("")
        try {
            const res = await fetch(
                `/api/stores/${encodeURIComponent(activeStoreMeta.id)}/shopify-access-token`,
                {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ accessToken: trimmed }),
                },
            )
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                setTokenError(
                    typeof data?.message === "string"
                        ? data.message
                        : "Could not update token. Try again.",
                )
                return
            }
            setTokenSuccess("Token saved and verified with Shopify.")
            setNewShopifyToken("")
        } catch {
            setTokenError("Something went wrong. Try again.")
        } finally {
            setTokenLoading(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError("")
        setSuccess("")

        try {
            // Validate password change if provided
            if (formData.newPassword || formData.currentPassword) {
                if (!formData.currentPassword) {
                    setError("Current password is required to change password")
                    setLoading(false)
                    return
                }
                if (formData.newPassword !== formData.confirmPassword) {
                    setError("New passwords do not match")
                    setLoading(false)
                    return
                }
                if (!isStrongPassword(formData.newPassword)) {
                    setError("New password must be at least 8 characters and include upper, lower, number and special character")
                    setLoading(false)
                    return
                }
            }

            const updateData: { businessName?: string; currentPassword?: string; newPassword?: string } = {}

            if (formData.businessName) {
                updateData.businessName = formData.businessName
            }

            if (formData.newPassword) {
                updateData.currentPassword = formData.currentPassword
                updateData.newPassword = formData.newPassword
            }

            const bodyCheck = accountUpdateSchema.safeParse(updateData)
            if (!bodyCheck.success) {
                setError(bodyCheck.error.issues[0]?.message ?? "Invalid input")
                setLoading(false)
                return
            }

            const res = await fetch("/api/settings/account", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(bodyCheck.data),
            })

            if (!res.ok) {
                const data = await res.json()
                setError(data.message || "Failed to update account")
                return
            }

            setSuccess("Account updated successfully")
            setFormData(prev => ({ ...prev, currentPassword: "", newPassword: "", confirmPassword: "" }))
            
            // Update session
            await update()
        } catch {
            setError("An error occurred. Please try again.")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-bold text-white">Account Information</h2>
                <p className="text-sm text-slate-400 mt-1">Update your business name and password.</p>
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

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Email (Read-only) */}
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                    <label className="flex items-center gap-2 text-sm font-bold text-slate-400 mb-2">
                        <Mail className="w-4 h-4" />
                        Email Address
                    </label>
                    <input
                        type="email"
                        value={session?.user?.email || ""}
                        disabled
                        className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-slate-500 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <p className="text-xs text-slate-500 mt-1">Email cannot be changed</p>
                </div>

                {/* Business Name */}
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                    <label className="flex items-center gap-2 text-sm font-bold text-slate-400 mb-2">
                        <Building className="w-4 h-4" />
                        Business Name
                    </label>
                    <input
                        type="text"
                        value={formData.businessName}
                        onChange={(e) => setFormData(prev => ({ ...prev, businessName: e.target.value }))}
                        placeholder="Enter your business name"
                        maxLength={200}
                        className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-slate-500 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50"
                    />
                </div>

                {/* Password Change Section */}
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                    <label className="flex items-center gap-2 text-sm font-bold text-slate-400 mb-4">
                        <User className="w-4 h-4" />
                        Change Password
                    </label>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-medium text-slate-400 mb-2">Current Password</label>
                            <input
                                type="password"
                                value={formData.currentPassword}
                                onChange={(e) => setFormData(prev => ({ ...prev, currentPassword: e.target.value }))}
                                placeholder="Enter current password"
                                maxLength={128}
                                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-slate-500 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-400 mb-2">New Password</label>
                            <input
                                type="password"
                                value={formData.newPassword}
                                onChange={(e) => setFormData(prev => ({ ...prev, newPassword: e.target.value }))}
                                placeholder="Enter new password"
                                maxLength={128}
                                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-slate-500 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-400 mb-2">Confirm New Password</label>
                            <input
                                type="password"
                                value={formData.confirmPassword}
                                onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                                placeholder="Confirm new password"
                                maxLength={128}
                                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-slate-500 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50"
                            />
                        </div>
                    </div>
                </div>

                <div className="flex justify-end">
                    <button
                        type="submit"
                        disabled={loading}
                        className="px-6 py-2.5 bg-indigo-500 text-white rounded-xl font-bold hover:bg-indigo-600 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4" />
                                Save Changes
                            </>
                        )}
                    </button>
                </div>
            </form>

            {/* Shopify access token (collapsed by default — reinstall / new scopes) */}
            {activeStoreMeta ? (
                <div className="border-t border-white/10 pt-6">
                    <button
                        type="button"
                        onClick={toggleShopifyTokenPanel}
                        className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left transition-colors hover:bg-white/[0.07]"
                    >
                        <span className="flex min-w-0 items-center gap-2">
                            <KeyRound className="h-4 w-4 shrink-0 text-indigo-400" />
                            <span className="min-w-0">
                                <span className="block text-sm font-bold text-white">
                                    Shopify access token
                                </span>
                                <span className="block truncate text-xs text-slate-500">
                                    {activeStoreMeta.businessName} · {activeStoreMeta.shopifyDomain}
                                </span>
                            </span>
                        </span>
                        <ChevronDown
                            className={cn(
                                "h-4 w-4 shrink-0 text-slate-400 transition-transform",
                                shopifyTokenOpen && "rotate-180",
                            )}
                        />
                    </button>

                    {shopifyTokenOpen ? (
                        <div className="mt-3 space-y-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                            <p className="text-xs leading-relaxed text-slate-400">
                                Reinstalled your app in Shopify or added API permissions? Shopify issues a
                                new <strong className="text-slate-300">Admin API access token</strong>.
                                Paste it here—your store domain stays the same; we verify the token with
                                Shopify before saving.
                            </p>
                            {tokenSuccess ? (
                                <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
                                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                                    {tokenSuccess}
                                </div>
                            ) : null}
                            {tokenError ? (
                                <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                                    <AlertCircle className="h-4 w-4 shrink-0" />
                                    {tokenError}
                                </div>
                            ) : null}
                            <div>
                                <label className="mb-2 block text-xs font-medium text-slate-400">
                                    New Admin API access token
                                </label>
                                <input
                                    type="password"
                                    autoComplete="off"
                                    value={newShopifyToken}
                                    maxLength={SHOPIFY_TOKEN_MAX}
                                    onChange={(e) =>
                                        setNewShopifyToken(
                                            e.target.value.slice(0, SHOPIFY_TOKEN_MAX),
                                        )
                                    }
                                    placeholder="shpat_…"
                                    className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 font-mono text-sm text-white placeholder:text-slate-600 focus:border-indigo-500/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                />
                            </div>
                            <div className="flex justify-end">
                                <button
                                    type="button"
                                    disabled={tokenLoading || !newShopifyToken.trim()}
                                    onClick={() => void saveShopifyAccessToken()}
                                    className="flex items-center gap-2 rounded-xl bg-indigo-500 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {tokenLoading ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Verifying…
                                        </>
                                    ) : (
                                        <>
                                            <KeyRound className="h-4 w-4" />
                                            Save token
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    ) : null}
                </div>
            ) : null}

            {/* Push notifications */}
            <div className="pt-6 border-t border-white/10">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Bell className="w-5 h-5" />
                    Push notifications
                </h2>
                <p className="text-sm text-slate-400 mt-1 mb-4">
                    Get notified in your browser when you receive new messages and updates.
                    When you click Enable, your browser will show a permission prompt—choose <strong>Allow</strong>.
                </p>
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                    {pushLoading ? (
                        <div className="flex items-center gap-2 text-slate-400">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span className="text-sm">Checking notification status...</span>
                        </div>
                    ) : !("Notification" in window) || !("serviceWorker" in navigator) ? (
                        <p className="text-sm text-slate-400">
                            Push notifications are not supported in this browser.
                        </p>
                    ) : permission === "denied" ? (
                        <p className="text-sm text-slate-400">
                            Notifications are blocked. Enable them in your browser settings for this site, then refresh the page.
                        </p>
                    ) : isSubscribed ? (
                        <div className="flex items-center justify-between gap-4 flex-wrap">
                            <div className="flex items-center gap-2 text-emerald-400">
                                <CheckCircle2 className="w-5 h-5" />
                                <span className="text-sm font-medium">Notifications enabled</span>
                            </div>
                            <button
                                type="button"
                                onClick={async () => {
                                    setPushActionLoading(true)
                                    await unsubscribe()
                                    setPushActionLoading(false)
                                }}
                                disabled={pushActionLoading}
                                className="px-4 py-2 rounded-lg text-sm font-medium bg-white/10 text-slate-300 hover:bg-white/20 transition-colors flex items-center gap-2 disabled:opacity-50"
                            >
                                {pushActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BellOff className="w-4 h-4" />}
                                Disable
                            </button>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={async () => {
                                setPushActionLoading(true)
                                setError("")
                                const result = await subscribe()
                                setPushActionLoading(false)
                                if (!result.success) {
                                    setError(result.error ?? "Could not enable notifications. Try again or check browser settings.")
                                }
                            }}
                            disabled={pushActionLoading}
                            className="px-4 py-2.5 bg-indigo-500 text-white rounded-xl font-bold hover:bg-indigo-600 transition-colors flex items-center gap-2 disabled:opacity-50"
                        >
                            {pushActionLoading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Enabling...
                                </>
                            ) : (
                                <>
                                    <Bell className="w-4 h-4" />
                                    Enable notifications
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
