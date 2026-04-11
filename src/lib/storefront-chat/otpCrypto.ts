import crypto from "node:crypto"

/** OTP validity (send to email). */
export const STOREFRONT_OTP_TTL_MS = 10 * 60 * 1000

/** Verified widget session length (spec: ~1h). */
export const STOREFRONT_SESSION_TTL_MS = 60 * 60 * 1000

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
