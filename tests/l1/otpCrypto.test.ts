import { describe, expect, it } from "vitest"
import { hashStorefrontOtp } from "@/lib/storefront-chat/otpCrypto"

describe("hashStorefrontOtp", () => {
    it("is deterministic for same inputs", () => {
        const a = hashStorefrontOtp("123456", "store1", "visitor1")
        const b = hashStorefrontOtp("123456", "store1", "visitor1")
        expect(a).toBe(b)
        expect(a.length).toBe(64)
    })

    it("differs when code changes", () => {
        const a = hashStorefrontOtp("123456", "store1", "visitor1")
        const b = hashStorefrontOtp("000000", "store1", "visitor1")
        expect(a).not.toBe(b)
    })
})
