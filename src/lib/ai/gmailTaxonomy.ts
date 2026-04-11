/**
 * Gmail triage: intent/mood strings used by `classifyCustomerEmail` and auto-reply guardrails.
 */
export const GMAIL_INTENTS = [
    "general",
    "shipping_delay",
    "refund_request",
    "question",
    "account_billing",
    "off_topic",
] as const

export const GMAIL_MOODS = ["neutral", "angry", "confused", "happy"] as const

export type GmailIntent = (typeof GMAIL_INTENTS)[number]
export type GmailMood = (typeof GMAIL_MOODS)[number]

export type GmailClassification = {
    intent: GmailIntent
    mood: GmailMood
    confidence: number
    short_summary: string
}

export function isGmailIntent(v: string): v is GmailIntent {
    return (GMAIL_INTENTS as readonly string[]).includes(v)
}

export function isGmailMood(v: string): v is GmailMood {
    return (GMAIL_MOODS as readonly string[]).includes(v)
}

export function normalizeClassification(raw: {
    intent?: string
    mood?: string
    confidence?: number
    short_summary?: string
}): GmailClassification {
    const intent = raw.intent && isGmailIntent(raw.intent) ? raw.intent : "general"
    const mood = raw.mood && isGmailMood(raw.mood) ? raw.mood : "neutral"
    const confidence =
        typeof raw.confidence === "number" && Number.isFinite(raw.confidence)
            ? Math.min(1, Math.max(0, raw.confidence))
            : 0.5
    const short_summary =
        typeof raw.short_summary === "string" ? raw.short_summary.slice(0, 500) : ""

    return { intent, mood, confidence, short_summary }
}

export function parseJsonObject<T extends Record<string, unknown>>(text: string): T | null {
    const trimmed = text.trim()
    try {
        const obj = JSON.parse(trimmed) as T
        return obj && typeof obj === "object" ? obj : null
    } catch {
        const start = trimmed.indexOf("{")
        const end = trimmed.lastIndexOf("}")
        if (start >= 0 && end > start) {
            try {
                const obj = JSON.parse(trimmed.slice(start, end + 1)) as T
                return obj && typeof obj === "object" ? obj : null
            } catch {
                return null
            }
        }
        return null
    }
}
