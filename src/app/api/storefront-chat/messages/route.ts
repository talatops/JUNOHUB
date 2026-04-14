import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import {
    storeSelectStorefrontChatApi,
    storeSelectStorefrontConversationSession,
} from "@/lib/prisma/storeSelects"
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

const STOREFRONT_TICKET_TRIGGER = "STOREFRONT_TICKET"

function shouldCreateEscalationTicket(ai: { content: string; meta?: { usedTools?: string[]; module?: string } }): boolean {
    if (Array.isArray(ai.meta?.usedTools) && ai.meta.usedTools.includes("ticket_intake")) {
        return true
    }
    if (ai.meta?.module === "HUMAN_ESCALATION") {
        return true
    }
    const text = (ai.content || "").toLowerCase()
    return (
        text.includes("human will follow up") ||
        text.includes("passed your request to our team") ||
        text.includes("passed your request to the team")
    )
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

        const raw = await req.json().catch(() => ({}))
        const parsed = storefrontChatPostSchema.safeParse(raw)
        if (!parsed.success) {
            return validationErrorResponse(parsed.error)
        }
        const { shop, visitorId, content: trimmedContent, customerEmail } = parsed.data

        const normalizedShop = normalizeShopDomain(shop)

        const variants = shopVariants(normalizedShop)
        const stores = await prisma.store.findMany({
            where: { shopifyDomain: { in: variants } },
            select: storeSelectStorefrontChatApi,
        })

        const store =
            stores.find((s) => Boolean(s.storefrontChatEnabled)) || stores[0]
        if (!store) {
            return NextResponse.json({ message: "Store not found" }, { status: 404 })
        }
        if (!store.storefrontChatEnabled) {
            return NextResponse.json({ message: "Widget disabled" }, { status: 403 })
        }

        // Find or create conversation for this anonymous visitor.
        let conversation = await prisma.storefrontChatConversation.findFirst({
            where: { storeId: store.id, visitorId },
            select: storeSelectStorefrontConversationSession,
        })

        if (conversation) {
            // Very lightweight rate limit: max 5 messages per 30 seconds per conversation.
            const windowMs = 30_000
            const recentCount = await prisma.storefrontChatMessage.count({
                where: {
                    conversationId: conversation.id,
                    createdAt: { gte: new Date(Date.now() - windowMs) },
                },
            })

            if (recentCount >= 5) {
                return NextResponse.json({ message: "Too many messages, slow down" }, { status: 429 })
            }
        } else {
            conversation = await prisma.storefrontChatConversation.create({
                data: {
                    storeId: store.id,
                    visitorId,
                    customerEmail: customerEmail ?? null,
                },
                select: storeSelectStorefrontConversationSession,
            })
        }

        const customerMessage = await prisma.storefrontChatMessage.create({
            data: {
                conversationId: conversation.id,
                senderType: "CUSTOMER",
                content: trimmedContent
            },
            select: { id: true, createdAt: true, senderType: true, content: true }
        })

        const recentHistory = await prisma.storefrontChatMessage.findMany({
            where: { conversationId: conversation.id },
            orderBy: { createdAt: "asc" },
            take: 10,
            select: { senderType: true, content: true },
        })

        const sessionOk =
            Boolean(conversation.emailVerifiedAt) &&
            conversation.sessionExpiresAt &&
            (conversation.sessionExpiresAt as unknown as Date).getTime() > Date.now()

        const ai = await generateStorefrontReply({
            storeId: store.id,
            storeName: store.businessName || "Our store",
            query: trimmedContent,
            visitorId,
            history: recentHistory.map((m) => ({
                senderType: m.senderType,
                content: m.content,
            })),
            aiModulesJson: store.aiModules,
            sharedFieldAnswersJson: store.sharedFieldAnswers,
            categoryMetadetailsEnabled: store.categoryMetadetailsEnabled,
            widgetVerifiedEmail: sessionOk ? conversation.assertedEmail : null,
            widgetSessionExpiresAt: sessionOk ? conversation.sessionExpiresAt : null,
            boundShopifyOrderId: conversation.boundShopifyOrderId,
        })

        const aiMessage = await prisma.storefrontChatMessage.create({
            data: {
                conversationId: conversation.id,
                senderType: "AI",
                content: ai.content
            },
            select: { id: true, createdAt: true, senderType: true, content: true }
        })

        if (shouldCreateEscalationTicket(ai)) {
            try {
                const owner = await prisma.store.findUnique({
                    where: { id: store.id },
                    select: { userId: true },
                })
                const convoEmail = await prisma.storefrontChatConversation.findUnique({
                    where: { id: conversation.id },
                    select: { customerEmail: true },
                })
                const ticketTo =
                    convoEmail?.customerEmail?.trim().toLowerCase() ||
                    customerEmail?.trim().toLowerCase() ||
                    `visitor+${visitorId}@storefront.local`
                const ticketSubject = `[Storefront] ${ai.meta.module} · ${conversation.id}`

                const existing = await prisma.emailLog.findFirst({
                    where: {
                        storeId: store.id,
                        to: ticketTo,
                        subject: ticketSubject,
                        trigger: STOREFRONT_TICKET_TRIGGER,
                    },
                    select: { id: true },
                })

                if (existing) {
                    await prisma.emailLog.update({
                        where: { id: existing.id },
                        data: {
                            bodyPreview: trimmedContent.slice(0, 2000),
                            sentAt: new Date(),
                            status: "SENT",
                        },
                    })
                } else if (owner?.userId) {
                    await prisma.emailLog.create({
                        data: {
                            userId: owner.userId,
                            storeId: store.id,
                            to: ticketTo,
                            subject: ticketSubject,
                            bodyPreview: trimmedContent.slice(0, 2000),
                            isAutomated: true,
                            trigger: STOREFRONT_TICKET_TRIGGER,
                            status: "SENT",
                        },
                    })
                }
            } catch (ticketErr) {
                console.error("[STOREFRONT_TICKET_CREATE_ERR]", ticketErr)
            }
        }

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
        const stores = await prisma.store.findMany({
            where: { shopifyDomain: { in: variants } },
            select: { id: true, storefrontChatEnabled: true },
        })

        const store =
            stores.find((s) => Boolean(s.storefrontChatEnabled)) || stores[0]

        if (!store) {
            return NextResponse.json({ message: "Store not found" }, { status: 404 })
        }
        if (!store.storefrontChatEnabled) {
            return NextResponse.json({ message: "Widget disabled" }, { status: 403 })
        }

        const conversation = await prisma.storefrontChatConversation.findFirst({
            where: { storeId: store.id, visitorId },
            select: { id: true },
        })

        if (!conversation) {
            return NextResponse.json({ success: true, messages: [] })
        }

        const messages = await prisma.storefrontChatMessage.findMany({
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

