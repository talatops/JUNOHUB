import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { generateStorefrontReply } from "@/lib/ai/storefrontGroq"
import { applyRateLimit } from "@/lib/rate-limit"
import { storefrontChatPostSchema } from "@/lib/api-schemas/public"
import { validationErrorResponse } from "@/lib/api-schemas/validate"

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
        const rate = await applyRateLimit(req, "public:storefront-chat", {
            windowMs: 60_000,
            maxRequests: 40,
        })
        if (!rate.success) {
            return NextResponse.json(
                { message: "Too many requests. Please try again later." },
                { status: 429 },
            )
        }

        const p = prisma as any
        const raw = await req.json().catch(() => ({}))
        const parsed = storefrontChatPostSchema.safeParse(raw)
        if (!parsed.success) {
            return validationErrorResponse(parsed.error)
        }
        const { shop, visitorId, content: trimmedContent, customerEmail } = parsed.data

        const normalizedShop = normalizeShopDomain(shop)

        const variants = shopVariants(normalizedShop)
        const stores = await p.store.findMany({
            where: { shopifyDomain: { in: variants } },
            select: { id: true, storefrontChatEnabled: true }
        })

        const store = stores.find((s: any) => Boolean(s.storefrontChatEnabled)) || stores[0]
        if (!store) {
            return NextResponse.json({ message: "Store not found" }, { status: 404 })
        }
        if (!store.storefrontChatEnabled) {
            return NextResponse.json({ message: "Widget disabled" }, { status: 403 })
        }

        // Find or create conversation for this anonymous visitor.
        let conversation = await p.storefrontChatConversation.findFirst({
            where: { storeId: store.id, visitorId },
            select: { id: true }
        })

        if (conversation) {
            // Very lightweight rate limit: max 5 messages per 30 seconds per conversation.
            const windowMs = 30_000
            const recentCount = await p.storefrontChatMessage.count({
                where: {
                    conversationId: conversation.id,
                    createdAt: { gte: new Date(Date.now() - windowMs) }
                }
            })

            if (recentCount >= 5) {
                return NextResponse.json({ message: "Too many messages, slow down" }, { status: 429 })
            }
        } else {
            conversation = await p.storefrontChatConversation.create({
                data: {
                    storeId: store.id,
                    visitorId,
                    customerEmail: customerEmail ?? null,
                },
                select: { id: true }
            })
        }

        const customerMessage = await p.storefrontChatMessage.create({
            data: {
                conversationId: conversation.id,
                senderType: "CUSTOMER",
                content: trimmedContent
            },
            select: { id: true, createdAt: true, senderType: true, content: true }
        })

        const recentHistory = await p.storefrontChatMessage.findMany({
            where: { conversationId: conversation.id },
            orderBy: { createdAt: "asc" },
            take: 10,
            select: { senderType: true, content: true }
        })

        const ai = await generateStorefrontReply({
            storeId: store.id,
            query: trimmedContent,
            visitorId,
            history: recentHistory.map((m: any) => ({
                senderType: m.senderType,
                content: m.content
            }))
        })

        const aiMessage = await p.storefrontChatMessage.create({
            data: {
                conversationId: conversation.id,
                senderType: "AI",
                content: ai.content
            },
            select: { id: true, createdAt: true, senderType: true, content: true }
        })

        return NextResponse.json({
            success: true,
            messages: [customerMessage, aiMessage],
            meta: ai.meta
        })
    } catch (error) {
        console.error("[STORE_FRONT_CHAT_MESSAGES_POST]", error)
        return NextResponse.json({ message: "Internal Error" }, { status: 500 })
    }
}

export async function GET(req: Request) {
    try {
        const p = prisma as any
        const { searchParams } = new URL(req.url)
        const shop = searchParams.get("shop")?.trim() || ""
        const visitorId = searchParams.get("visitorId")?.trim() || ""

        if (!shop) {
            return NextResponse.json({ message: "Missing shop" }, { status: 400 })
        }
        if (!visitorId) {
            return NextResponse.json({ message: "Missing visitorId" }, { status: 400 })
        }

        const normalizedShop = normalizeShopDomain(shop)
        const variants = shopVariants(normalizedShop)
        const stores = await p.store.findMany({
            where: { shopifyDomain: { in: variants } },
            select: { id: true, storefrontChatEnabled: true }
        })

        const store = stores.find((s: any) => Boolean(s.storefrontChatEnabled)) || stores[0]

        if (!store) {
            return NextResponse.json({ message: "Store not found" }, { status: 404 })
        }
        if (!store.storefrontChatEnabled) {
            return NextResponse.json({ message: "Widget disabled" }, { status: 403 })
        }

        const conversation = await p.storefrontChatConversation.findFirst({
            where: { storeId: store.id, visitorId },
            select: { id: true }
        })

        if (!conversation) {
            return NextResponse.json({ success: true, messages: [] })
        }

        const messages = await p.storefrontChatMessage.findMany({
            where: { conversationId: conversation.id },
            orderBy: { createdAt: "asc" },
            take: 120,
            select: { id: true, content: true, senderType: true, createdAt: true }
        })

        return NextResponse.json({ success: true, messages })
    } catch (error) {
        console.error("[STORE_FRONT_CHAT_MESSAGES_GET]", error)
        return NextResponse.json({ message: "Internal Error" }, { status: 500 })
    }
}

