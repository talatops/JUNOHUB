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
import { extractOrderNumberHints } from "@/lib/ai/gmailContext"
import { getOrderDetailForVerifiedEmail } from "@/lib/ai/tools/orderTools"

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
const ESCALATION_ALREADY_DISPATCHED_REPLY =
    "Your request is already dispatched to our human support team. Please wait for the follow-up email from our team."
const ORDER_VERIFICATION_REQUIRED_REPLY =
    "To help with order-specific requests, please verify your email first using the Order help section below."
const ORDER_NOT_FOUND_FOR_VERIFIED_EMAIL_REPLY =
    "I could not find that order for your verified email. Please double-check the order number and try again."

function formatEscalationModuleLabel(moduleName?: string): string {
    const raw = (moduleName || "CUSTOMER_SUPPORT").trim()
    return raw
        .split(/[_\s]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(" ")
}

function buildStorefrontTicketSubject(moduleName?: string): string {
    return `${formatEscalationModuleLabel(moduleName)} Request`
}

function buildOrderScopedTicketSubject(moduleName?: string, orderNumber?: string | null): string {
    const base = buildStorefrontTicketSubject(moduleName)
    const clean = (orderNumber || "").replace(/^\s*#?\s*/, "").trim()
    if (!clean) return base
    return `${base} - Order ${clean}`
}

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
            orderBy: { createdAt: "desc" },
            take: 4,
            select: { senderType: true, content: true },
        })
        const historyForAi = recentHistory.reverse()

        const sessionOk =
            Boolean(conversation.emailVerifiedAt) &&
            conversation.sessionExpiresAt &&
            (conversation.sessionExpiresAt as unknown as Date).getTime() > Date.now()

        const ai = await generateStorefrontReply({
            storeId: store.id,
            storeName: store.businessName || "Our store",
            query: trimmedContent,
            visitorId,
            history: historyForAi.map((m) => ({
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

        const convoEmail = await prisma.storefrontChatConversation.findUnique({
            where: { id: conversation.id },
            select: { customerEmail: true },
        })
        const ticketTo =
            convoEmail?.customerEmail?.trim().toLowerCase() ||
            customerEmail?.trim().toLowerCase() ||
            `visitor+${visitorId}@storefront.local`
        const isEscalation = shouldCreateEscalationTicket(ai)
        const verifiedEmail =
            sessionOk && conversation.assertedEmail
                ? conversation.assertedEmail.trim().toLowerCase()
                : null
        const requestedOrderHint = extractOrderNumberHints(trimmedContent)[0] ?? null
        const hasOrderSpecificRequest = Boolean(requestedOrderHint)
        const verifiedOrder =
            isEscalation && verifiedEmail && requestedOrderHint
                ? await getOrderDetailForVerifiedEmail(store.id, verifiedEmail, {
                      orderNumberHint: requestedOrderHint,
                  })
                : null
        const ticketSubject = buildOrderScopedTicketSubject(ai.meta?.module, verifiedOrder?.orderNumber)

        // Security-first guardrail:
        // For order-specific requests, only escalate when the referenced order is verified for the
        // currently verified email session.
        const blockedForMissingVerification = isEscalation && hasOrderSpecificRequest && !verifiedEmail
        const blockedForOrderMismatch = isEscalation && hasOrderSpecificRequest && verifiedEmail && !verifiedOrder

        const existingEscalation =
            isEscalation && !blockedForMissingVerification && !blockedForOrderMismatch
            ? await prisma.emailLog.findFirst({
                  where: {
                      storeId: store.id,
                      trigger: STOREFRONT_TICKET_TRIGGER,
                      to: ticketTo,
                      subject: ticketSubject,
                  },
                  select: { id: true },
              })
            : null

        const alreadyEscalated = isEscalation && Boolean(existingEscalation)
        const aiContent = blockedForMissingVerification
            ? ORDER_VERIFICATION_REQUIRED_REPLY
            : blockedForOrderMismatch
              ? ORDER_NOT_FOUND_FOR_VERIFIED_EMAIL_REPLY
              : alreadyEscalated
                ? ESCALATION_ALREADY_DISPATCHED_REPLY
                : ai.content

        const aiMessage = await prisma.storefrontChatMessage.create({
            data: {
                conversationId: conversation.id,
                senderType: "AI",
                content: aiContent
            },
            select: { id: true, createdAt: true, senderType: true, content: true }
        })

        if (
            isEscalation &&
            !alreadyEscalated &&
            !blockedForMissingVerification &&
            !blockedForOrderMismatch
        ) {
            try {
                const owner = await prisma.store.findUnique({
                    where: { id: store.id },
                    select: { userId: true },
                })
                if (owner?.userId) {
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

