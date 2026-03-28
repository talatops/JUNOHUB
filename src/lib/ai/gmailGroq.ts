import { groqChatCompletion } from "@/lib/ai/groqClient"
import {
    GMAIL_INTENTS,
    GMAIL_MOODS,
    normalizeClassification,
    parseJsonObject,
    type GmailClassification,
    type GmailIntent,
    type GmailMood,
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

export async function classifyCustomerEmail(subject: string, bodyExcerpt: string): Promise<GmailClassification> {
    const user = `Subject: ${subject.slice(0, 500)}\n\nMessage (excerpt):\n${bodyExcerpt.slice(0, 3500)}`

    const { content, error } = await groqChatCompletion(
        [
            { role: "system", content: CLASSIFY_SYSTEM },
            { role: "user", content: user },
        ],
        { jsonObject: true, temperature: 0.1, maxTokens: 256 }
    )

    if (!content) {
        logger.info("Gmail classification skipped (Groq unavailable)", { error })
        return normalizeClassification({})
    }

    const parsed = parseJsonObject<Record<string, unknown>>(content)
    if (!parsed) {
        logger.warn("Gmail classification JSON parse failed")
        return normalizeClassification({})
    }

    return normalizeClassification({
        intent: typeof parsed.intent === "string" ? parsed.intent : undefined,
        mood: typeof parsed.mood === "string" ? parsed.mood : undefined,
        confidence: typeof parsed.confidence === "number" ? parsed.confidence : undefined,
        short_summary:
            typeof parsed.short_summary === "string" ? parsed.short_summary : undefined,
    })
}

export type GeneratedReplyPayload = {
    html_body: string
    name: string
    description: string
    intent: GmailIntent
    mood: GmailMood
}

const GENERATE_SYSTEM = `You write professional HTML email replies for an e-commerce support team.

Rules:
- Output JSON only with keys: html_body, name, description, intent, mood
- html_body: a single customer-ready email as HTML (use simple tags: p, br, div). No external scripts. Be empathetic and concise.
- Use ONLY facts from order_context when present. If order_context is empty, do NOT invent order numbers, tracking URLs, or amounts.
- name: short internal template title (max 80 chars)
- description: one line for staff
- intent and mood must be one of the allowed values exactly.

Allowed intents: ${GMAIL_INTENTS.join(", ")}
Allowed moods: ${GMAIL_MOODS.join(", ")}`

export async function generateReplyAndTemplateFields(input: {
    subject: string
    bodyExcerpt: string
    classification: GmailClassification
    orderSummary: string
    storeName: string
    customerFirstName: string
}): Promise<GeneratedReplyPayload | null> {
    const user = JSON.stringify({
        subject: input.subject.slice(0, 500),
        message_excerpt: input.bodyExcerpt.slice(0, 3500),
        classified_intent: input.classification.intent,
        classified_mood: input.classification.mood,
        short_summary: input.classification.short_summary,
        order_context: input.orderSummary || "(none — do not invent order details)",
        store_name: input.storeName,
        customer_name_hint: input.customerFirstName,
    })

    const { content, error } = await groqChatCompletion(
        [
            { role: "system", content: GENERATE_SYSTEM },
            { role: "user", content: user },
        ],
        { jsonObject: true, temperature: 0.35, maxTokens: 1500 }
    )

    if (!content) {
        logger.warn("Gmail reply generation failed", { error })
        return null
    }

    const parsed = parseJsonObject<Record<string, unknown>>(content)
    if (!parsed || typeof parsed.html_body !== "string") {
        logger.warn("Gmail reply generation invalid JSON")
        return null
    }

    const normalized = normalizeClassification({
        intent: typeof parsed.intent === "string" ? parsed.intent : input.classification.intent,
        mood: typeof parsed.mood === "string" ? parsed.mood : input.classification.mood,
    })

    return {
        html_body: parsed.html_body.trim(),
        name:
            typeof parsed.name === "string"
                ? parsed.name.slice(0, 120)
                : `AI reply — ${input.classification.intent}`,
        description:
            typeof parsed.description === "string"
                ? parsed.description.slice(0, 500)
                : "Auto-generated from customer email",
        intent: normalized.intent,
        mood: normalized.mood,
    }
}
