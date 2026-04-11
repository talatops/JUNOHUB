import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendEmail } from "@/lib/email"
import { applyRateLimit } from "@/lib/rate-limit"
import { storefrontOtpRequestSchema } from "@/lib/api-schemas/public"
import { validationErrorResponse } from "@/lib/api-schemas/validate"
import {
    generateSixDigitOtp,
    hashStorefrontOtp,
    STOREFRONT_OTP_TTL_MS,
} from "@/lib/storefront-chat/otpCrypto"

function normalizeShopDomain(input: string) {
    return input
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//i, "")
        .replace(/\/$/, "")
}

function shopVariants(cleanDomain: string) {
    if (!cleanDomain) return []
    const v = new Set<string>()
    v.add(cleanDomain)
    v.add(`${cleanDomain}/`)
    v.add(`https://${cleanDomain}`)
    v.add(`http://${cleanDomain}`)
    return Array.from(v)
}

export async function POST(req: Request) {
    try {
        const rate = await applyRateLimit(req, "public:storefront-otp-request", {
            windowMs: 60_000,
            maxRequests: 5,
        })
        if (!rate.success) {
            return NextResponse.json(
                { message: "Too many code requests. Please try again later." },
                { status: 429 },
            )
        }

        const raw = await req.json().catch(() => ({}))
        const parsed = storefrontOtpRequestSchema.safeParse(raw)
        if (!parsed.success) {
            return validationErrorResponse(parsed.error)
        }
        const { shop, visitorId, email } = parsed.data
        const normalizedShop = normalizeShopDomain(shop)
        const variants = shopVariants(normalizedShop)

        const stores = await prisma.store.findMany({
            where: { shopifyDomain: { in: variants } },
            select: { id: true, storefrontChatEnabled: true, businessName: true },
        })
        const store =
            stores.find((s) => Boolean(s.storefrontChatEnabled)) || stores[0]
        if (!store) {
            return NextResponse.json({ message: "Store not found" }, { status: 404 })
        }
        if (!store.storefrontChatEnabled) {
            return NextResponse.json({ message: "Widget disabled" }, { status: 403 })
        }

        const emailNorm = email.trim().toLowerCase()
        const code = generateSixDigitOtp()
        const otpHash = hashStorefrontOtp(code, store.id, visitorId)
        const otpExpiresAt = new Date(Date.now() + STOREFRONT_OTP_TTL_MS)

        await prisma.storefrontChatConversation.upsert({
            where: {
                storeId_visitorId: { storeId: store.id, visitorId },
            },
            create: {
                storeId: store.id,
                visitorId,
                customerEmail: emailNorm,
                assertedEmail: emailNorm,
                otpHash,
                otpExpiresAt,
            },
            update: {
                customerEmail: emailNorm,
                assertedEmail: emailNorm,
                otpHash,
                otpExpiresAt,
                emailVerifiedAt: null,
                sessionExpiresAt: null,
                boundShopifyOrderId: null,
            },
        })

        const storeLabel = store.businessName || "Store"
        await sendEmail({
            to: emailNorm,
            subject: `Your verification code — ${storeLabel}`,
            html: `
<!DOCTYPE html>
<html><body style="font-family:system-ui,sans-serif;padding:24px;background:#0b1220;color:#e5e7eb;">
  <p>Your verification code is:</p>
  <p style="font-size:28px;font-weight:700;letter-spacing:4px;">${code}</p>
  <p style="color:#9ca3af;font-size:14px;">This code expires in 10 minutes. If you did not request this, you can ignore this email.</p>
</body></html>`,
        })

        return NextResponse.json({
            success: true,
            message: "If that email is valid, we sent a 6-digit code.",
        })
    } catch (error) {
        console.error("[STOREFRONT_OTP_REQUEST]", error)
        return NextResponse.json({ message: "Internal Error" }, { status: 500 })
    }
}
