import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { storefrontChatEventSchema } from "@/lib/api-schemas/public"
import { validationErrorResponse } from "@/lib/api-schemas/validate"
import { logAiAnalyticsEvent } from "@/lib/analytics/aiEvents"

function normalizeShopDomain(input: string) {
    return input.trim().toLowerCase().replace(/^https?:\/\//i, "").replace(/\/$/, "")
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
        const raw = await req.json().catch(() => ({}))
        const parsed = storefrontChatEventSchema.safeParse(raw)
        if (!parsed.success) {
            return validationErrorResponse(parsed.error)
        }

        const { shop, visitorId, type, productId, variantId, sourceMessageId } = parsed.data
        const stores = await prisma.store.findMany({
            where: { shopifyDomain: { in: shopVariants(normalizeShopDomain(shop)) } },
            select: { id: true, storefrontChatEnabled: true },
        })
        const store = stores.find((s) => Boolean(s.storefrontChatEnabled)) || stores[0]
        if (!store || !store.storefrontChatEnabled) {
            return NextResponse.json({ success: true })
        }

        const conversation = await prisma.storefrontChatConversation.findFirst({
            where: { storeId: store.id, visitorId },
            select: { id: true },
        })

        if (conversation) {
            void logAiAnalyticsEvent({
                storeId: store.id,
                conversationId: conversation.id,
                messageId: sourceMessageId ?? null,
                eventType: type,
                productId: productId ?? null,
                variantId: variantId ?? null,
                metadata: { source: "widget_action" },
            })
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("[STOREFRONT_CHAT_EVENTS_POST]", error)
        return NextResponse.json({ success: true })
    }
}
