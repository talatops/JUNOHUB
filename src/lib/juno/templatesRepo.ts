import { prisma } from "@/lib/prisma"
import { randomUUID } from "crypto"
import type { GmailIntent, GmailMood } from "@/lib/ai/gmailTaxonomy"

export type TemplateRecord = {
    id: string
    storeId: string
    name: string
    intent: string
    mood: string
    description: string | null
    body: string
    variables: unknown | null
    isHtml: boolean
    updatedAt: Date
}

/**
 * Latest template for store + intent + mood (same semantics as JUNO Engine list).
 */
export async function findTemplateByIntentMood(
    storeId: string,
    intent: GmailIntent,
    mood: GmailMood
): Promise<TemplateRecord | null> {
    const rows = await prisma.$queryRaw<TemplateRecord[]>`
        SELECT
            "id",
            "storeId",
            "name",
            "intent",
            "mood",
            "description",
            "body",
            "variables",
            "isHtml",
            "updatedAt"
        FROM "Template"
        WHERE "storeId" = ${storeId}
          AND "intent" = ${intent}
          AND "mood" = ${mood}
        ORDER BY "updatedAt" DESC
        LIMIT 1
    `
    return rows[0] ?? null
}

/**
 * Fallback when intent/mood pair has no row: try general + same mood, then general + neutral.
 */
export async function findTemplateWithFallback(
    storeId: string,
    intent: GmailIntent,
    mood: GmailMood
): Promise<TemplateRecord | null> {
    const exact = await findTemplateByIntentMood(storeId, intent, mood)
    if (exact) return exact

    // Avoid general+happy (etc.) for off-topic — those templates thank the customer and may show order data in {{order_summary}}.
    if (intent === "off_topic") {
        if (mood !== "neutral") {
            const offNeutral = await findTemplateByIntentMood(storeId, "off_topic", "neutral")
            if (offNeutral) return offNeutral
        }
        const generalNeutral = await findTemplateByIntentMood(storeId, "general", "neutral")
        if (generalNeutral) return generalNeutral
        return findTemplateByIntentMood(storeId, "general", "happy")
    }

    if (intent !== "general") {
        const generalMood = await findTemplateByIntentMood(storeId, "general", mood)
        if (generalMood) return generalMood
    }

    if (mood !== "neutral") {
        const intentNeutral = await findTemplateByIntentMood(storeId, intent, "neutral")
        if (intentNeutral) return intentNeutral
    }

    return findTemplateByIntentMood(storeId, "general", "neutral")
}

export type InsertTemplateInput = {
    storeId: string
    name: string
    intent: GmailIntent
    mood: GmailMood
    description: string | null
    body: string
    variables: Record<string, unknown> | null
    isHtml: boolean
}

export async function insertTemplate(input: InsertTemplateInput): Promise<TemplateRecord> {
    const id = randomUUID()
    const variablesParam = input.variables as Record<string, unknown> | null
    const rows = await prisma.$queryRaw<TemplateRecord[]>`
        INSERT INTO "Template"
            ("id", "storeId", "name", "intent", "mood", "description", "body", "variables", "isHtml", "createdAt", "updatedAt")
        VALUES
            (${id}, ${input.storeId}, ${input.name}, ${input.intent}, ${input.mood}, ${input.description}, ${input.body}, ${variablesParam}, ${input.isHtml}, NOW(), NOW())
        RETURNING
            "id",
            "storeId",
            "name",
            "intent",
            "mood",
            "description",
            "body",
            "variables",
            "isHtml",
            "updatedAt"
    `
    const row = rows[0]
    if (!row) {
        throw new Error("insertTemplate: no row returned")
    }
    return row
}
