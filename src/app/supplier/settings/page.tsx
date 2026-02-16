"use client"

import { useEffect, useState } from "react"
import {
    Building2,
    FileText,
    Loader2,
    AlertCircle,
    CheckCircle2,
    Save,
    Bell,
    BellOff
} from "lucide-react"
import { usePushNotifications } from "@/hooks/usePushNotifications"

interface SupplierProfile {
    id: string
    companyName: string
    description: string | null
    user: {
        name: string | null
        email: string | null
    }
    _count: {
        products: number
        connections: number
    }
}

export default function SupplierSettingsPage() {
    const { permission, isSubscribed, loading: pushLoading, subscribe, unsubscribe } = usePushNotifications()
    const [pushActionLoading, setPushActionLoading] = useState(false)
    const [profile, setProfile] = useState<SupplierProfile | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState("")
    const [success, setSuccess] = useState("")
    const [formData, setFormData] = useState({
        companyName: "",
        description: ""
    })

    useEffect(() => {
        fetchProfile()
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

    const fetchProfile = async () => {
        try {
            setLoading(true)
            const res = await fetch("/api/supplier/profile")
            if (!res.ok) throw new Error("Failed to fetch profile")
            const data = await res.json()
            setProfile(data.profile)
            setFormData({
                companyName: data.profile.companyName || "",
                description: data.profile.description || ""
            })
            setError("")
        } catch {
            setError("Failed to load profile")
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)
        setError("")

        try {
            const res = await fetch("/api/supplier/profile", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData)
            })

            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.message || "Failed to update profile")
            }

            setSuccess("Profile updated successfully")
            fetchProfile()
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to update profile")
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">Settings</h1>
                <p className="text-sm md:text-base text-slate-400 mt-1">Manage your supplier account settings</p>
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

            {/* Profile Information */}
            <div className="bg-white/5 rounded-xl p-6 border border-white/10">
                <div className="flex items-center gap-3 mb-6">
                    <Building2 className="w-5 h-5 text-indigo-400" />
                    <h2 className="text-lg font-bold text-white">Company Information</h2>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-2">Company Name *</label>
                        <input
                            type="text"
                            required
                            value={formData.companyName}
                            onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                            className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50"
                            placeholder="Your company name"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-2">Description</label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            rows={4}
                            className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50"
                            placeholder="Describe your company and what you supply..."
                        />
                    </div>

                    <div className="flex items-center justify-end pt-4">
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-6 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {saving ? (
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
            </div>

            {/* Account Stats */}
            {profile && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white/5 rounded-xl p-6 border border-white/10">
                        <div className="flex items-center gap-3 mb-4">
                            <FileText className="w-5 h-5 text-slate-400" />
                            <h3 className="text-sm font-medium text-slate-400">Account Information</h3>
                        </div>
                        <div className="space-y-2">
                            <div>
                                <span className="text-xs text-slate-500">Email</span>
                                <p className="text-sm font-medium text-white">{profile.user.email}</p>
                            </div>
                            <div>
                                <span className="text-xs text-slate-500">Name</span>
                                <p className="text-sm font-medium text-white">{profile.user.name || "—"}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white/5 rounded-xl p-6 border border-white/10">
                        <div className="flex items-center gap-3 mb-4">
                            <Building2 className="w-5 h-5 text-slate-400" />
                            <h3 className="text-sm font-medium text-slate-400">Business Stats</h3>
                        </div>
                        <div className="space-y-2">
                            <div>
                                <span className="text-xs text-slate-500">Total Products</span>
                                <p className="text-sm font-medium text-white">{profile._count.products}</p>
                            </div>
                            <div>
                                <span className="text-xs text-slate-500">Vendor Connections</span>
                                <p className="text-sm font-medium text-white">{profile._count.connections}</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Push notifications */}
            <div className="pt-6 border-t border-white/10">
                <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-1">
                    <Bell className="w-5 h-5" />
                    Push notifications
                </h2>
                <p className="text-sm text-slate-400 mb-4">
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
                                if (!result.success) setError(result.error ?? "Could not enable notifications. Try again or check browser settings.")
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
