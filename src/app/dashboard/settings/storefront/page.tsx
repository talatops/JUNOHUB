"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import toast from "react-hot-toast"
import { CheckCircle2, Loader2, MessageCircle, Timer } from "lucide-react"
import {
    MAX_STOREFRONT_OTP_SESSION_MINUTES,
    MIN_STOREFRONT_OTP_SESSION_MINUTES,
} from "@/lib/storefront-chat/otpCrypto"

const MAX_HOURS = Math.floor(MAX_STOREFRONT_OTP_SESSION_MINUTES / 60)

function splitTotalMinutes(total: number): { hours: number; minutes: number } {
    const h = Math.floor(total / 60)
    const m = total % 60
    return { hours: h, minutes: m }
}

export default function StorefrontSettingsPage() {
    const [activeStoreId, setActiveStoreId] = useState<string | null>(null)
    const [hoursDraft, setHoursDraft] = useState("1")
    const [minutesDraft, setMinutesDraft] = useState("0")
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
                storefrontOtpSessionMinutes?: number
            }
            const total =
                typeof s.storefrontOtpSessionMinutes === "number"
                    ? s.storefrontOtpSessionMinutes
                    : 60
            const { hours, minutes } = splitTotalMinutes(total)
            setHoursDraft(String(hours))
            setMinutesDraft(String(minutes))
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
        const hTrim = hoursDraft.trim()
        const mTrim = minutesDraft.trim()
        const h = hTrim === "" ? 0 : Number.parseInt(hTrim, 10)
        const m = mTrim === "" ? 0 : Number.parseInt(mTrim, 10)
        if (!Number.isFinite(h) || h < 0 || h > MAX_HOURS || !Number.isFinite(m) || m < 0 || m > 59) {
            toast.error(`Hours: 0–${MAX_HOURS}, minutes: 0–59.`)
            return
        }
        if (h === MAX_HOURS && m > 0) {
            toast.error(`Maximum session is ${MAX_HOURS} hours (10080 minutes).`)
            return
        }
        const totalMinutes = h * 60 + m
        if (totalMinutes < MIN_STOREFRONT_OTP_SESSION_MINUTES) {
            toast.error(`Session must be at least ${MIN_STOREFRONT_OTP_SESSION_MINUTES} minutes total.`)
            return
        }
        if (totalMinutes > MAX_STOREFRONT_OTP_SESSION_MINUTES) {
            toast.error(`Session cannot exceed ${MAX_STOREFRONT_OTP_SESSION_MINUTES} minutes (one week).`)
            return
        }

        setSaving(true)
        try {
            const res = await fetch(`/api/stores/${activeStoreId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ storefrontOtpSessionMinutes: totalMinutes }),
            })
            const data = (await res.json().catch(() => ({}))) as { message?: string }
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
            toast.success("Storefront session length saved.")
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Could not save")
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-bold text-white">Storefront chat (OTP session)</h2>
                <p className="text-sm text-slate-400 mt-1">
                    After a customer verifies their email with a one-time code, the widget stays signed in for
                    this length. The code itself still expires in 10 minutes; this only affects the session after
                    verification.
                </p>
            </div>

            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <label className="flex items-center gap-2 text-sm font-bold text-slate-400 mb-3">
                    <MessageCircle className="w-4 h-4" />
                    Verified session length
                </label>
                <div className="flex flex-wrap items-end gap-4">
                    <div className="space-y-2">
                        <label htmlFor="otp-session-hours" className="text-xs text-slate-500 block">
                            Hours
                        </label>
                        <input
                            id="otp-session-hours"
                            type="text"
                            inputMode="numeric"
                            value={hoursDraft}
                            onChange={(e) => setHoursDraft(e.target.value.replace(/[^\d]/g, ""))}
                            className="w-24 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-slate-500 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50"
                            aria-describedby="otp-session-hint"
                        />
                    </div>
                    <div className="space-y-2">
                        <label htmlFor="otp-session-minutes" className="text-xs text-slate-500 block">
                            Minutes
                        </label>
                        <input
                            id="otp-session-minutes"
                            type="text"
                            inputMode="numeric"
                            value={minutesDraft}
                            onChange={(e) => {
                                const raw = e.target.value.replace(/[^\d]/g, "").slice(0, 2)
                                if (raw === "") {
                                    setMinutesDraft("")
                                    return
                                }
                                const n = Number.parseInt(raw, 10)
                                setMinutesDraft(String(Math.min(59, n)))
                            }}
                            className="w-24 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-slate-500 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50"
                            aria-describedby="otp-session-hint"
                        />
                    </div>
                </div>
                <p id="otp-session-hint" className="text-xs text-slate-500 mt-3 flex items-start gap-2">
                    <Timer className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" aria-hidden />
                    <span>
                        Total must be between <strong className="text-slate-300">{MIN_STOREFRONT_OTP_SESSION_MINUTES}</strong> and{" "}
                        <strong className="text-slate-300">{MAX_STOREFRONT_OTP_SESSION_MINUTES}</strong> minutes (up to{" "}
                        {MAX_HOURS} hours). Default was 1 hour.
                    </span>
                </p>
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
                        "Save"
                    )}
                </button>
            </div>
        </div>
    )
}
