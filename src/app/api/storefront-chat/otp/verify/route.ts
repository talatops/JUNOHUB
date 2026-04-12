import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { applyRateLimit } from "@/lib/rate-limit"
import { storefrontOtpVerifySchema } from "@/lib/api-schemas/public"
import { validationErrorResponse } from "@/lib/api-schemas/validate"
import {
    hashStorefrontOtp,
    storefrontSessionTtlMsFromMinutes,
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
        const rate = await applyRateLimit(req, "public:storefront-otp-verify", {
            windowMs: 60_000,
            maxRequests: 20,
        })
        if (!rate.success) {
            return NextResponse.json(
                { message: "Too many attempts. Please try again later." },
                { status: 429 },
            )
        }

        const raw = await req.json().catch(() => ({}))
        const parsed = storefrontOtpVerifySchema.safeParse(raw)
        if (!parsed.success) {
            return validationErrorResponse(parsed.error)
        }
        const { shop, visitorId, email, code } = parsed.data
        const normalizedShop = normalizeShopDomain(shop)
        const variants = shopVariants(normalizedShop)

        const stores = await prisma.store.findMany({
            where: { shopifyDomain: { in: variants } },
            select: { id: true, storefrontChatEnabled: true, storefrontOtpSessionMinutes: true },
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
        const conv = await prisma.storefrontChatConversation.findUnique({
            where: {
                storeId_visitorId: { storeId: store.id, visitorId },
            },
            select: {
                assertedEmail: true,
                otpHash: true,
                otpExpiresAt: true,
            },
        })

        if (!conv?.otpHash || !conv.otpExpiresAt) {
            return NextResponse.json(
                { message: "No active code. Request a new one." },
                { status: 400 },
            )
        }
        if (conv.assertedEmail?.toLowerCase() !== emailNorm) {
            return NextResponse.json({ message: "Email does not match." }, { status: 400 })
        }
        if (conv.otpExpiresAt.getTime() < Date.now()) {
            return NextResponse.json(
                { message: "Code expired. Request a new one." },
                { status: 400 },
            )
        }

        const expected = hashStorefrontOtp(code, store.id, visitorId)
        if (expected !== conv.otpHash) {
            return NextResponse.json({ message: "Invalid code." }, { status: 400 })
        }

        const sessionMs = storefrontSessionTtlMsFromMinutes(store.storefrontOtpSessionMinutes)
        const sessionExpiresAt = new Date(Date.now() + sessionMs)

        await prisma.storefrontChatConversation.update({
            where: {
                storeId_visitorId: { storeId: store.id, visitorId },
            },
            data: {
                otpHash: null,
                otpExpiresAt: null,
                emailVerifiedAt: new Date(),
                sessionExpiresAt,
                assertedEmail: emailNorm,
            },
        })

        return NextResponse.json({
            success: true,
            verified: true,
            sessionExpiresAt: sessionExpiresAt.toISOString(),
        })
    } catch (error) {
        console.error("[STOREFRONT_OTP_VERIFY]", error)
        return NextResponse.json({ message: "Internal Error" }, { status: 500 })
    }
}
