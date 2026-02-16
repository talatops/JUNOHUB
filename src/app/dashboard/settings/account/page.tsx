"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { User, Mail, Building, Save, Loader2, CheckCircle2, AlertCircle, Bell, BellOff } from "lucide-react"
import { usePushNotifications } from "@/hooks/usePushNotifications"

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

    useEffect(() => {
        // Fetch user's business name (from first store or user name)
        const fetchBusinessName = async () => {
            try {
                const res = await fetch("/api/stores")
                if (res.ok) {
                    const data = await res.json()
                    const activeStore = data.stores?.find((s: { isActive: boolean }) => s.isActive)
                    if (activeStore?.businessName) {
                        setFormData(prev => ({ ...prev, businessName: activeStore.businessName }))
                    } else if (session?.user?.name) {
                        setFormData(prev => ({ ...prev, businessName: session.user.name || "" }))
                    }
                }
            } catch {
                // Silent fail
            }
        }
        fetchBusinessName()
    }, [session])

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
                if (formData.newPassword.length < 8) {
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

            const res = await fetch("/api/settings/account", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updateData)
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

            {/* Push notifications */}
            <div className="pt-6 border-t border-white/10">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Bell className="w-5 h-5" />
                    Push notifications
                </h2>
                <p className="text-sm text-slate-400 mt-1 mb-4">
                    Get notified in your browser when you receive new messages and updates.
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
                                const ok = await subscribe()
                                setPushActionLoading(false)
                                if (!ok) {
                                    setError("Could not enable notifications. Check that the site has permission.")
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
