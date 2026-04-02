import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { generateStorefrontReply } from "@/lib/ai/storefrontGroq"

type StorefrontMessagePayload = {
    shop: string
    visitorId: string
    content: string
    customerEmail?: string | null
}

export async function POST(req: Request) {
    try {
        const p = prisma as any
        const payload = (await req.json().catch(() => ({}))) as Partial<StorefrontMessagePayload>
        const { shop, visitorId, content } = payload

        if (typeof shop !== "string" || !shop.trim()) {
            return NextResponse.json({ message: "Missing shop" }, { status: 400 })
        }
        if (typeof visitorId !== "string" || !visitorId.trim()) {
            return NextResponse.json({ message: "Missing visitorId" }, { status: 400 })
        }
        if (typeof content !== "string") {
            return NextResponse.json({ message: "Missing content" }, { status: 400 })
        }

        const trimmedContent = content.trim()
        const trimmedVisitorId = visitorId.trim()
        const trimmedShop = shop.trim()

        // Guardrails (v1): keep it small, avoid empty spam.
        if (trimmedContent.length < 1) {
            return NextResponse.json({ message: "Empty message" }, { status: 400 })
        }
        if (trimmedContent.length > 2000) {
            return NextResponse.json({ message: "Message too long" }, { status: 400 })
        }
        if (trimmedVisitorId.length > 300) {
            return NextResponse.json({ message: "Invalid visitorId" }, { status: 400 })
        }

        const store = await p.store.findFirst({
            where: { shopifyDomain: trimmedShop },
            select: { id: true, storefrontChatEnabled: true }
        })

        if (!store) {
            return NextResponse.json({ message: "Store not found" }, { status: 404 })
        }
        if (!store.storefrontChatEnabled) {
            return NextResponse.json({ message: "Widget disabled" }, { status: 403 })
        }

        // Find or create conversation for this anonymous visitor.
        let conversation = await p.storefrontChatConversation.findFirst({
            where: { storeId: store.id, visitorId: trimmedVisitorId },
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
                    visitorId: trimmedVisitorId,
                    customerEmail: payload.customerEmail ?? null
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
            visitorId: trimmedVisitorId,
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

        const store = await p.store.findFirst({
            where: { shopifyDomain: shop },
            select: { id: true, storefrontChatEnabled: true }
        })

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

