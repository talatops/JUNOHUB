"use client"

import { useState, useEffect } from "react"
import { Shield, Smartphone, Monitor, MapPin, Clock, X, CheckCircle2, AlertCircle, Loader2, QrCode, Copy } from "lucide-react"
import Image from "next/image"

interface Session {
    id: string
    sessionToken: string
    expires: string
    userAgent?: string
    ipAddress?: string
    isCurrent: boolean
}

export default function SecuritySettingsPage() {
    const [sessions, setSessions] = useState<Session[]>([])
    const [loading, setLoading] = useState(true)
    const [mfaEnabled, setMfaEnabled] = useState(false)
    const [mfaLoading, setMfaLoading] = useState(false)
    const [setupLoading, setSetupLoading] = useState(false)
    const [verifying, setVerifying] = useState(false)
    const [error, setError] = useState("")
    const [success, setSuccess] = useState("")
    const [qrCode, setQrCode] = useState<string | null>(null)
    const [manualEntryKey, setManualEntryKey] = useState<string | null>(null)
    const [verificationCode, setVerificationCode] = useState("")
    const [showSetup, setShowSetup] = useState(false)

    useEffect(() => {
        fetchSessions()
        fetchMFAStatus()
    }, [])

    const fetchSessions = async () => {
        try {
            const res = await fetch("/api/settings/sessions")
            if (res.ok) {
                const data = await res.json()
                setSessions(data.sessions || [])
            }
        } catch {
            setError("Failed to load sessions")
        } finally {
            setLoading(false)
        }
    }

    const fetchMFAStatus = async () => {
        try {
            const res = await fetch("/api/settings/mfa/status")
            if (res.ok) {
                const data = await res.json()
                setMfaEnabled(data.enabled || false)
            }
        } catch {
            // Silent fail
        }
    }

    // Clear success/error messages after 5 seconds
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

    const handleSetupMFA = async () => {
        setSetupLoading(true)
        setError("")
        setSuccess("")
        try {
            const res = await fetch("/api/settings/mfa/setup", {
                method: "POST"
            })
            if (res.ok) {
                const responseData = await res.json()
                setQrCode(responseData.qrCode)
                setManualEntryKey(responseData.manualEntryKey)
                setShowSetup(true)
            } else {
                const errorData = await res.json()
                setError(errorData.message || "Failed to set up MFA")
            }
        } catch {
            setError("An error occurred while setting up MFA")
        } finally {
            setSetupLoading(false)
        }
    }

    const handleVerifyAndEnable = async () => {
        if (!verificationCode || verificationCode.length !== 6) {
            setError("Please enter a valid 6-digit verification code")
            return
        }

        setVerifying(true)
        setError("")
        try {
            const res = await fetch("/api/settings/mfa/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code: verificationCode })
            })
            if (res.ok) {
                setMfaEnabled(true)
                setShowSetup(false)
                setQrCode(null)
                setManualEntryKey(null)
                setVerificationCode("")
                setSuccess("MFA enabled successfully! You will be required to enter a verification code when signing in.")
            } else {
                const errorData = await res.json()
                setError(errorData.message || "Invalid verification code")
            }
        } catch {
            setError("An error occurred while verifying the code")
        } finally {
            setVerifying(false)
        }
    }

    const handleCopyKey = () => {
        if (manualEntryKey) {
            navigator.clipboard.writeText(manualEntryKey)
            setSuccess("Secret key copied to clipboard")
            setTimeout(() => setSuccess(""), 3000)
        }
    }

    const handleRevokeSession = async (sessionId: string) => {
        try {
            const res = await fetch(`/api/settings/sessions/${sessionId}`, {
                method: "DELETE"
            })
            if (res.ok) {
                setSessions(prev => prev.filter(s => s.id !== sessionId))
                setSuccess("Session revoked successfully")
            } else {
                setError("Failed to revoke session")
            }
        } catch {
            setError("An error occurred")
        }
    }

    const handleDisableMFA = async () => {
        if (!confirm("Are you sure you want to disable MFA? This will reduce your account security.")) {
            return
        }

        setMfaLoading(true)
        setError("")
        try {
            const res = await fetch("/api/settings/mfa/toggle", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ enabled: false })
            })
            if (res.ok) {
                setMfaEnabled(false)
                setShowSetup(false)
                setQrCode(null)
                setManualEntryKey(null)
                setSuccess("MFA disabled successfully")
            } else {
                const errorData = await res.json()
                setError(errorData.message || "Failed to disable MFA")
            }
        } catch {
            setError("An error occurred")
        } finally {
            setMfaLoading(false)
        }
    }

    const getDeviceIcon = (userAgent?: string) => {
        if (!userAgent) return Monitor
        if (userAgent.includes("Mobile") || userAgent.includes("Android") || userAgent.includes("iPhone")) {
            return Smartphone
        }
        return Monitor
    }

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString()
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-bold text-white">Security Settings</h2>
                <p className="text-sm text-slate-400 mt-1">Manage your security preferences and active sessions.</p>
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

            {/* MFA Section */}
            <div className="bg-white/5 rounded-xl p-6 border border-white/10">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                            <Shield className="w-5 h-5 text-indigo-400" />
                            <h3 className="text-lg font-bold text-white">Multi-Factor Authentication (MFA)</h3>
                        </div>
                        <p className="text-sm text-slate-400">
                            Add an extra layer of security to your account by requiring a verification code in addition to your password.
                        </p>
                    </div>
                    {mfaEnabled ? (
                        <button
                            onClick={handleDisableMFA}
                            disabled={mfaLoading}
                            className="w-full sm:w-auto px-4 py-2 rounded-lg font-bold text-sm transition-colors flex items-center justify-center gap-2 bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {mfaLoading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Disabling...
                                </>
                            ) : (
                                "Disable MFA"
                            )}
                        </button>
                    ) : (
                        <button
                            onClick={handleSetupMFA}
                            disabled={setupLoading || showSetup}
                            className="w-full sm:w-auto px-4 py-2 rounded-lg font-bold text-sm transition-colors flex items-center justify-center gap-2 bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {setupLoading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Setting up...
                                </>
                            ) : (
                                <>
                                    <QrCode className="w-4 h-4" />
                                    Set Up MFA
                                </>
                            )}
                        </button>
                    )}
                </div>

                {/* MFA Setup Flow */}
                {showSetup && !mfaEnabled && (
                    <div className="mt-6 p-6 bg-white/5 border border-white/10 rounded-xl space-y-4">
                        <div>
                            <h4 className="text-sm font-bold text-white mb-2">Step 1: Scan QR Code</h4>
                            <p className="text-xs text-slate-400 mb-4">
                                Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
                            </p>
                            {qrCode && (
                                <div className="flex flex-col items-center gap-4">
                                    <div className="p-4 bg-white rounded-lg">
                                        <Image src={qrCode} alt="MFA QR Code" width={192} height={192} className="w-48 h-48" />
                                    </div>
                                    <div className="w-full">
                                        <label className="block text-xs font-medium text-slate-400 mb-2">
                                            Manual Entry Key (if you can&apos;t scan)
                                        </label>
                                        <div className="flex items-center gap-2">
                                            <code className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-xs font-mono text-white break-all">
                                                {manualEntryKey}
                                            </code>
                                            <button
                                                onClick={handleCopyKey}
                                                className="p-2 bg-white/10 hover:bg-white/15 rounded-lg text-slate-400 hover:text-white transition-colors"
                                                title="Copy key"
                                            >
                                                <Copy className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="pt-4 border-t border-white/10">
                            <h4 className="text-sm font-bold text-white mb-2">Step 2: Verify Code</h4>
                            <p className="text-xs text-slate-400 mb-4">
                                Enter the 6-digit code from your authenticator app to enable MFA
                            </p>
                            <div className="flex items-center gap-3">
                                <div className="flex-1">
                                    <input
                                        type="text"
                                        value={verificationCode}
                                        onChange={(e) => {
                                            const value = e.target.value.replace(/\D/g, "").slice(0, 6)
                                            setVerificationCode(value)
                                        }}
                                        placeholder="000000"
                                        className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-slate-500 text-center text-2xl font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50"
                                        maxLength={6}
                                    />
                                </div>
                                <button
                                    onClick={handleVerifyAndEnable}
                                    disabled={verifying || verificationCode.length !== 6}
                                    className="px-6 py-2 bg-indigo-500 text-white rounded-lg font-bold hover:bg-indigo-600 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {verifying ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Verifying...
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle2 className="w-4 h-4" />
                                            Enable
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {mfaEnabled && (
                    <div className="mt-4 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                            <p className="text-sm text-emerald-400 font-medium">
                                MFA is currently enabled. You will be required to enter a verification code when signing in.
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Active Sessions */}
            <div className="bg-white/5 rounded-xl p-6 border border-white/10">
                <div className="flex items-center gap-3 mb-4">
                    <Monitor className="w-5 h-5 text-indigo-400" />
                    <h3 className="text-lg font-bold text-white">Active Sessions</h3>
                </div>
                <p className="text-sm text-slate-400 mb-4">
                    These are the devices currently logged into your account. Revoke any sessions you don&apos;t recognize.
                </p>

                {loading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
                    </div>
                ) : sessions.length === 0 ? (
                    <div className="text-center py-8 text-slate-400">
                        <p>No active sessions found</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {sessions.map((sessionItem) => {
                            const DeviceIcon = getDeviceIcon(sessionItem.userAgent)
                            return (
                                <div
                                    key={sessionItem.id}
                                    className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10"
                                >
                                    <div className="flex items-center gap-4 flex-1">
                                        <div className="w-10 h-10 rounded-lg bg-indigo-500/20 border border-indigo-400/20 flex items-center justify-center">
                                            <DeviceIcon className="w-5 h-5 text-indigo-400" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-sm font-bold text-white">
                                                    {sessionItem.userAgent || "Unknown Device"}
                                                </span>
                                                {sessionItem.isCurrent && (
                                                    <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs font-bold rounded-full">
                                                        Current
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-4 text-xs text-slate-400">
                                                {sessionItem.ipAddress && (
                                                    <div className="flex items-center gap-1">
                                                        <MapPin className="w-3 h-3" />
                                                        {sessionItem.ipAddress}
                                                    </div>
                                                )}
                                                <div className="flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    {formatDate(sessionItem.expires)}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    {!sessionItem.isCurrent && (
                                        <button
                                            onClick={() => handleRevokeSession(sessionItem.id)}
                                            className="p-2 hover:bg-red-500/20 rounded-lg text-red-400 hover:text-red-300 transition-colors"
                                            title="Revoke session"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
