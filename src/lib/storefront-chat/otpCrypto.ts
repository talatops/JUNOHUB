import crypto from "node:crypto"

/** OTP validity (send to email). */
export const STOREFRONT_OTP_TTL_MS = 10 * 60 * 1000

/** Default verified session if store value missing (60 minutes). */
export const DEFAULT_STOREFRONT_OTP_SESSION_MINUTES = 60

export const MIN_STOREFRONT_OTP_SESSION_MINUTES = 5

/** One week — upper bound for vendor-configured session length. */
export const MAX_STOREFRONT_OTP_SESSION_MINUTES = 10080

/** @deprecated Prefer storefrontSessionTtlMsFromMinutes(storeMinutes) */
export const STOREFRONT_SESSION_TTL_MS = DEFAULT_STOREFRONT_OTP_SESSION_MINUTES * 60 * 1000

/**
 * Converts store setting (minutes) to TTL for sessionExpiresAt after OTP verify.
 */
export function storefrontSessionTtlMsFromMinutes(
    minutes: number | null | undefined,
): number {
    const raw =
        minutes == null || !Number.isFinite(minutes)
            ? DEFAULT_STOREFRONT_OTP_SESSION_MINUTES
            : Number(minutes)
    const m = Math.round(raw)
    const clamped = Math.min(
        Math.max(m, MIN_STOREFRONT_OTP_SESSION_MINUTES),
        MAX_STOREFRONT_OTP_SESSION_MINUTES,
    )
    return clamped * 60 * 1000
}

export function hashStorefrontOtp(
    code: string,
    storeId: string,
    visitorId: string,
): string {
    const secret =
        process.env.STOREFRONT_OTP_SECRET?.trim() || "juno-storefront-otp-dev"
    return crypto
        .createHash("sha256")
        .update(`${secret}|${storeId}|${visitorId}|${code}`)
        .digest("hex")
}

export function generateSixDigitOtp(): string {
    return String(Math.floor(100000 + Math.random() * 900000))
}
