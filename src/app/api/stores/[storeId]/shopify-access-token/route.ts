import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { isVendorPortalRole } from "@/lib/auth-roles"
import { prisma } from "@/lib/prisma"
import { applyRateLimit } from "@/lib/rate-limit"
import { cleanShopifyDomain, pingShopifyAdminApi } from "@/lib/shopify/adminPing"
import { storeShopifyAccessTokenUpdateSchema, validationErrorResponse } from "@/lib/api-schemas"

/**
 * PATCH /api/stores/[storeId]/shopify-access-token
 * Update only the Shopify Admin API access token (e.g. after reinstalling the app or changing scopes).
 */
export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ storeId: string }> },
) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }
        if (!isVendorPortalRole(session.user.role)) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 })
        }

        const rate = await applyRateLimit(req, "settings:shopify-access-token", {
            maxRequests: 12,
            windowMs: 60_000,
        })
        if (!rate.success) {
            return NextResponse.json(
                { message: "Too many attempts. Please wait a minute and try again." },
                { status: 429 },
            )
        }

        const { storeId } = await params
        const raw = await req.json().catch(() => ({}))
        const parsed = storeShopifyAccessTokenUpdateSchema.safeParse(raw)
        if (!parsed.success) {
            return validationErrorResponse(parsed.error)
        }

        const store = await prisma.store.findFirst({
            where: { id: storeId, userId: session.user.id },
            select: { id: true, shopifyDomain: true, onboardingComplete: true },
        })

        if (!store) {
            return NextResponse.json({ message: "Store not found" }, { status: 404 })
        }

        if (!store.onboardingComplete) {
            return NextResponse.json(
                { message: "Complete store onboarding before updating the access token." },
                { status: 400 },
            )
        }

        const cleanDomain = cleanShopifyDomain(store.shopifyDomain)
        if (!cleanDomain) {
            return NextResponse.json(
                { message: "This store has no Shopify domain on file." },
                { status: 400 },
            )
        }

        const ping = await pingShopifyAdminApi(cleanDomain, parsed.data.accessToken)
        if (!ping.ok) {
            return NextResponse.json({ message: ping.message }, { status: 400 })
        }

        await prisma.store.update({
            where: { id: store.id },
            data: { shopifyAccessToken: parsed.data.accessToken },
        })

        return NextResponse.json({
            message: "Shopify access token updated successfully.",
            storeId: store.id,
        })
    } catch (error) {
        console.error("[shopify-access-token PATCH]", error)
        return NextResponse.json({ message: "Failed to update access token" }, { status: 500 })
    }
}
