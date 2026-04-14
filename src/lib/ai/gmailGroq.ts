import { aiChatCompletion, activeAiProvider } from "@/lib/ai/chatCompletion"
import {
    normalizeClassification,
    parseJsonObject,
    type GmailClassification,
} from "@/lib/ai/gmailTaxonomy"
import { logger } from "@/lib/logger"

const CLASSIFY_SYSTEM = `You are a support triage assistant. Classify the customer email into exactly one intent and one mood.

Intents (pick one):
- general: thanks, praise, vague contact, or unclear
- shipping_delay: where is my order, tracking, late delivery, not arrived
- refund_request: refund, return, chargeback, money back
- question: product details, how to use, sizing, features (not shipping/refund/billing)
- account_billing: wrong charge, subscription, invoice, payment issue
- off_topic: not related to this store — news, weather, politics, homework, jokes, other brands, random chat, or anything that is clearly not an order/product/shipping/refund/billing question for this shop

Moods (pick one):
- neutral: matter-of-fact
- angry: upset, caps, threats, strong frustration
- confused: unsure, "don't understand", conflicting info
- happy: polite, grateful, positive tone

Respond with JSON only: {"intent":"...","mood":"...","confidence":0.0-1.0,"short_summary":"one sentence"}`

export type ClassifyCustomerEmailResult = {
    classification: GmailClassification
    /** `fallback` when model call was unavailable or returned unparseable JSON. */
    source: "openai" | "groq" | "fallback"
}

export async function classifyCustomerEmail(
    subject: string,
    bodyExcerpt: string
): Promise<ClassifyCustomerEmailResult> {
    const user = `Subject: ${subject.slice(0, 500)}\n\nMessage (excerpt):\n${bodyExcerpt.slice(0, 3500)}`

    const { content, error } = await aiChatCompletion(
        [
            { role: "system", content: CLASSIFY_SYSTEM },
            { role: "user", content: user },
        ],
        { jsonObject: true, temperature: 0.1, maxTokens: 256 }
    )

    if (!content) {
        logger.info("Gmail classification skipped (model unavailable)", { error })
        return { classification: normalizeClassification({}), source: "fallback" }
    }

    const parsed = parseJsonObject<Record<string, unknown>>(content)
    if (!parsed) {
        logger.warn("Gmail classification JSON parse failed")
        return { classification: normalizeClassification({}), source: "fallback" }
    }

    return {
        classification: normalizeClassification({
            intent: typeof parsed.intent === "string" ? parsed.intent : undefined,
            mood: typeof parsed.mood === "string" ? parsed.mood : undefined,
            confidence: typeof parsed.confidence === "number" ? parsed.confidence : undefined,
            short_summary:
                typeof parsed.short_summary === "string" ? parsed.short_summary : undefined,
        }),
        source: activeAiProvider(),
    }
}
