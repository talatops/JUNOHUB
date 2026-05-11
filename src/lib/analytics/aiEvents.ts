import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"

export type AiAnalyticsEventType =
    | "customer_question"
    | "ai_answered"
    | "add_to_cart_clicked"
    | "cart_link_generated"
    | "cart_link_opened"
    | "upsell_shown"
    | "upsell_clicked"
    | "cross_sell_clicked"
    | "ticket_created"
    | "unresolved_question"
    | "resolved_by_ai"
    | "order_attributed"

export type AiAnalyticsSentiment = "positive" | "neutral" | "negative" | "urgent" | "unknown"
export type AiResolutionStatus = "resolved_by_ai" | "needs_follow_up" | "escalated" | "unknown"

export type LogAiAnalyticsEventInput = {
    storeId: string
    conversationId?: string | null
    messageId?: string | null
    eventType: AiAnalyticsEventType
    source?: string
    productId?: string | null
    variantId?: string | null
    quantity?: number | null
    amount?: number | null
    currency?: string | null
    sentiment?: AiAnalyticsSentiment | null
    resolutionStatus?: AiResolutionStatus | null
    orderId?: string | null
    attributionType?: "direct_upsell" | "direct_cross_sell" | "assisted_order" | null
    metadata?: unknown
    createdAt?: Date
}

function toJsonInput(value: unknown): Prisma.InputJsonValue | undefined {
    if (value === undefined) return undefined
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

export function classifyCustomerSentiment(text: string): AiAnalyticsSentiment {
    const t = text.trim().toLowerCase()
    if (!t) return "unknown"
    if (/\b(angry|furious|terrible|awful|scam|fraud|lawsuit|chargeback|urgent|asap|immediately)\b/.test(t)) {
        return "urgent"
    }
    if (/\b(bad|poor|wrong|broken|damaged|late|missing|not received|disappointed|unhappy|refund|complaint)\b/.test(t)) {
        return "negative"
    }
    if (/\b(thanks|thank you|great|love|good|perfect|helpful|awesome|excellent)\b/.test(t)) {
        return "positive"
    }
    return "neutral"
}

export function classifyAiResolution(params: {
    content: string
    usedTools?: string[]
    module?: string
}): AiResolutionStatus {
    const text = params.content.trim().toLowerCase()
    const tools = params.usedTools ?? []
    if (tools.includes("ticket_intake") || params.module === "HUMAN_ESCALATION") {
        return "escalated"
    }
    if (
        /\b(i don'?t know|do not have|don't have|could not find|cannot look up|can't look up|not available|human support|team can confirm|verify your email)\b/.test(
            text,
        )
    ) {
        return "needs_follow_up"
    }
    return text ? "resolved_by_ai" : "unknown"
}

export async function logAiAnalyticsEvent(input: LogAiAnalyticsEventInput): Promise<void> {
    try {
        await prisma.aiAnalyticsEvent.create({
            data: {
                storeId: input.storeId,
                conversationId: input.conversationId ?? null,
                messageId: input.messageId ?? null,
                eventType: input.eventType,
                source: input.source ?? "storefront_chat",
                productId: input.productId ?? null,
                variantId: input.variantId ?? null,
                quantity: input.quantity ?? null,
                amount: input.amount ?? null,
                currency: input.currency ?? null,
                sentiment: input.sentiment ?? null,
                resolutionStatus: input.resolutionStatus ?? null,
                orderId: input.orderId ?? null,
                attributionType: input.attributionType ?? null,
                metadata: toJsonInput(input.metadata),
                ...(input.createdAt ? { createdAt: input.createdAt } : {}),
            },
        })
    } catch (error) {
        logger.warn("logAiAnalyticsEvent failed", {
            eventType: input.eventType,
            storeId: input.storeId,
            message: error instanceof Error ? error.message : String(error),
        })
    }
}

export async function logAiAnalyticsEvents(inputs: LogAiAnalyticsEventInput[]): Promise<void> {
    await Promise.all(inputs.map((input) => logAiAnalyticsEvent(input)))
}
