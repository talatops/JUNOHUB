"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import toast from "react-hot-toast"
import { 
    Mail, 
    CheckCircle2,
    Loader2,
    Settings
} from "lucide-react"

function GmailConnectContent() {
    const searchParams = useSearchParams()
    const [isConnected, setIsConnected] = useState(false)
    const [connecting, setConnecting] = useState(false)
    const [loading, setLoading] = useState(true)
    const [gmailEmail, setGmailEmail] = useState<string | null>(null)

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

        // Check URL params for connection status
        const connected = searchParams.get("connected")
        const error = searchParams.get("error")
        
        if (connected === "true") {
            setIsConnected(true)
            setLoading(false)
            toast.success("Gmail connected successfully!")
            // Refresh connection status to get email
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
                    : "Redirect URI mismatch. Please check your Google Cloud Console OAuth configuration."
            }
            const errorMessage = errorMessages[error] || "Failed to connect Gmail. Please try again."
            toast.error(errorMessage, { duration: redirectUri ? 10000 : 5000 })
            setLoading(false)
        }
    }, [searchParams])

    const handleConnect = async () => {
        setConnecting(true)
        try {
            // Redirect to Gmail OAuth
            const res = await fetch("/api/integrations/gmail/connect", {
                method: "POST"
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
                method: "POST"
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

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
            </div>
        )
    }

    return (
        <div className="h-full flex flex-col space-y-4 md:space-y-6">
            <div className="bg-white/5 backdrop-blur-xl rounded-xl md:rounded-2xl border border-white/10 overflow-hidden p-6 md:p-8">
                <div className="flex flex-col items-center text-center space-y-6">
                    <div className={`w-20 h-20 rounded-2xl flex items-center justify-center border-2 ${
                        isConnected 
                            ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400" 
                            : "bg-white/10 border-white/20 text-slate-400"
                    }`}>
                        <Mail className="w-10 h-10" />
                    </div>

                    <div className="space-y-2">
                        <h2 className="text-2xl font-extrabold text-white">
                            {isConnected ? "Gmail Connected" : "Connect Your Gmail Account"}
                        </h2>
                        <p className="text-sm text-slate-400 max-w-md">
                            {isConnected 
                                ? "Your Gmail account is connected and ready to sync emails."
                                : "Connect your Gmail account to enable email syncing, ticket creation, and automated responses."
                            }
                        </p>
                    </div>

                    {isConnected ? (
                        <div className="w-full max-w-md space-y-4">
                            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex items-center gap-3">
                                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                                <div className="flex-1">
                                    <p className="text-sm font-bold text-emerald-400">Connection Active</p>
                                    <p className="text-xs text-slate-400 mt-1">
                                        {gmailEmail ? `Connected to ${gmailEmail}` : "Emails are being synced automatically"}
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={async () => {
                                        try {
                                            const res = await fetch("/api/integrations/gmail/poll", {
                                                method: "POST"
                                            })
                                            const data = await res.json()
                                            if (res.ok) {
                                                toast.success(`Processed ${data.processed} email(s)`)
                                            } else {
                                                toast.error("Failed to check emails")
                                            }
                                        } catch (error) {
                                            toast.error("Error checking emails")
                                        }
                                    }}
                                    className="flex-1 h-11 px-4 bg-white/10 border border-white/10 rounded-xl font-bold text-white hover:bg-white/15 transition-all flex items-center justify-center gap-2 text-sm"
                                >
                                    <Settings className="w-4 h-4" />
                                    Check Emails
                                </button>
                                <button
                                    onClick={handleDisconnect}
                                    className="flex-1 h-11 px-4 bg-red-500/20 border border-red-500/30 rounded-xl font-bold text-red-400 hover:bg-red-500/30 transition-all text-sm"
                                >
                                    Disconnect
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="w-full max-w-md space-y-4">
                            <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
                                <div className="flex items-start gap-3">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-bold text-white">Email Sync</p>
                                        <p className="text-xs text-slate-400 mt-1">Automatically sync incoming emails</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-bold text-white">Ticket Creation</p>
                                        <p className="text-xs text-slate-400 mt-1">Create support tickets from emails</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-bold text-white">Auto Responses</p>
                                        <p className="text-xs text-slate-400 mt-1">
                                            Send automated replies using L1 AI and your knowledge base (configure
                                            under JUNO Engine → Modules)
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={handleConnect}
                                disabled={connecting}
                                className="w-full h-12 bg-indigo-500 text-white rounded-xl font-bold hover:bg-indigo-600 border border-indigo-400/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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

                            <p className="text-xs text-slate-500 text-center">
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
        <Suspense fallback={
            <div className="h-full flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
            </div>
        }>
            <GmailConnectContent />
        </Suspense>
    )
}
