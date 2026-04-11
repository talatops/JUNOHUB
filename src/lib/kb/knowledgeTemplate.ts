import { z } from "zod"

/**
 * Minimal “store voice” fields for structured KB mode (v3).
 * Per-topic policies live under AI modules (modulePolicies on Store).
 */
export const STORE_VOICE_FIELD_KEYS = [
    "aiToneHowWeSound",
    "communicationFormality",
    "phrasesAndPromisesToAvoid",
    "whenWeDoNotKnow",
] as const

export type StoreVoiceFieldKey = (typeof STORE_VOICE_FIELD_KEYS)[number]

export const STORE_VOICE_FIELDS: {
    key: StoreVoiceFieldKey
    label: string
    description: string
    placeholder: string
}[] = [
    {
        key: "aiToneHowWeSound",
        label: "How should the AI sound?",
        description: "Tone, personality, and how you want customers to feel when they read replies.",
        placeholder:
            "e.g. Warm and helpful; short sentences; we say “we” and sound human, not robotic…",
    },
    {
        key: "communicationFormality",
        label: "Formality level",
        description: "How formal or casual the assistant should be.",
        placeholder: "e.g. Professional but friendly; avoid slang; or casual and upbeat…",
    },
    {
        key: "phrasesAndPromisesToAvoid",
        label: "Words or promises to avoid",
        description: "Things the AI must not say (legal, brand, or operational).",
        placeholder: "e.g. Never guarantee delivery dates; don’t say “free” unless…",
    },
    {
        key: "whenWeDoNotKnow",
        label: "When we’re not sure",
        description: "How the assistant should behave when the answer isn’t in your policies or data.",
        placeholder: "e.g. Say we’re not sure and invite them to email support with their order #…",
    },
]

/** @deprecated Use STORE_VOICE_FIELD_KEYS — kept for migrating old DB JSON */
const LEGACY_TEMPLATE_FIELD_KEYS = [
    "brandVoice",
    "shippingReturns",
    "sizingFit",
    "materialsCare",
    "policies",
    "differentiators",
] as const

const LEGACY_LABELS: Record<(typeof LEGACY_TEMPLATE_FIELD_KEYS)[number], string> = {
    brandVoice: "Brand voice",
    shippingReturns: "Shipping & returns",
    sizingFit: "Sizing & fit",
    materialsCare: "Materials & care",
    policies: "Policies",
    differentiators: "What makes you different",
}

export const KNOWLEDGE_TEMPLATE_ANSWER_MAX = 12_000

const genericAnswersRecordSchema = z
    .record(z.string().max(KNOWLEDGE_TEMPLATE_ANSWER_MAX))
    .optional()
    .superRefine((val, ctx) => {
        if (!val) return
        for (const k of Object.keys(val)) {
            if (!STORE_VOICE_FIELD_KEYS.includes(k as StoreVoiceFieldKey)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: `Unknown template field: ${k}`,
                })
            }
        }
    })

export const knowledgeTemplatePutSchema = z.object({
    knowledgeBaseMode: z.enum(["STRUCTURED", "DOCUMENTS"]).optional(),
    confirmDestructiveSwitch: z.boolean().optional(),
    template: z
        .object({
            /** v3 generic store-voice answers only */
            answers: genericAnswersRecordSchema,
        })
        .optional(),
})

/** Normalized template for storage + embedding (v3). */
export type KnowledgeTemplateStored = {
    version: 3
    genericAnswers: Partial<Record<StoreVoiceFieldKey, string>>
    updatedAt: string
}

type KnowledgeTemplateV2File = {
    version?: number
    legacyAnswers?: Record<string, string>
    sharedFields?: Record<string, string>
    misc?: string
    updatedAt?: string
}

type KnowledgeTemplateV1 = {
    version?: number
    answers?: Record<string, string>
    misc?: string
    updatedAt?: string
}

function normalizeGenericAnswers(
    raw: Record<string, string> | undefined,
): Partial<Record<StoreVoiceFieldKey, string>> {
    if (!raw) return {}
    const out: Partial<Record<StoreVoiceFieldKey, string>> = {}
    for (const key of STORE_VOICE_FIELD_KEYS) {
        const v = raw[key]
        if (typeof v === "string" && v.trim()) {
            out[key] = v.trim()
        }
    }
    return out
}

function migrateLegacySixFieldsToGeneric(
    legacy: Record<string, string> | undefined,
): Partial<Record<StoreVoiceFieldKey, string>> {
    if (!legacy) return {}
    const parts: string[] = []
    for (const key of LEGACY_TEMPLATE_FIELD_KEYS) {
        const t = legacy[key]?.trim()
        if (t) {
            parts.push(`${LEGACY_LABELS[key]}:\n${t}`)
        }
    }
    if (!parts.length) return {}
    return { aiToneHowWeSound: parts.join("\n\n---\n\n") }
}

/**
 * Coerce DB JSON to KnowledgeTemplateStored v3.
 * Migrates v1 answers, v2 legacyAnswers/sharedFields (sharedFields discarded from template).
 */
export function parseKnowledgeTemplateJson(json: unknown): KnowledgeTemplateStored | null {
    if (json == null || typeof json !== "object") return null
    const o = json as Record<string, unknown>
    const ver = o.version === 3 ? 3 : o.version === 2 ? 2 : 1

    if (ver === 3) {
        const gen = o.genericAnswers
        const genericAnswers =
            gen && typeof gen === "object" && !Array.isArray(gen)
                ? normalizeGenericAnswers(gen as Record<string, string>)
                : {}
        return {
            version: 3,
            genericAnswers,
            updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : new Date().toISOString(),
        }
    }

    if (ver === 2) {
        const v2 = o as KnowledgeTemplateV2File
        const legacyRaw = v2.legacyAnswers
        const fromLegacy =
            legacyRaw && typeof legacyRaw === "object" && !Array.isArray(legacyRaw)
                ? migrateLegacySixFieldsToGeneric(legacyRaw as Record<string, string>)
                : {}
        const gen = o.genericAnswers
        const explicit =
            gen && typeof gen === "object" && !Array.isArray(gen)
                ? normalizeGenericAnswers(gen as Record<string, string>)
                : {}
        const misc = typeof v2.misc === "string" && v2.misc.trim() ? v2.misc.trim() : ""
        const merged: Partial<Record<StoreVoiceFieldKey, string>> = { ...fromLegacy, ...explicit }
        if (misc) {
            const prev = merged.whenWeDoNotKnow ?? ""
            merged.whenWeDoNotKnow = [prev, `Additional notes:\n${misc}`]
                .filter(Boolean)
                .join("\n\n")
        }
        return {
            version: 3,
            genericAnswers: merged,
            updatedAt: v2.updatedAt || new Date().toISOString(),
        }
    }

    const v1 = o as KnowledgeTemplateV1
    const legacy = v1.answers as Record<string, string> | undefined
    const misc = v1.misc?.trim() || ""
    const fromLegacy = migrateLegacySixFieldsToGeneric(legacy)
    if (misc) {
        const prev = fromLegacy.whenWeDoNotKnow ?? ""
        fromLegacy.whenWeDoNotKnow = [prev, `Additional notes:\n${misc}`]
            .filter(Boolean)
            .join("\n\n")
    }
    return {
        version: 3,
        genericAnswers: fromLegacy,
        updatedAt: v1.updatedAt || new Date().toISOString(),
    }
}

export function buildKnowledgeTemplateStored(input: {
    answers?: Record<string, string>
}): KnowledgeTemplateStored {
    return {
        version: 3,
        genericAnswers: normalizeGenericAnswers(input.answers),
        updatedAt: new Date().toISOString(),
    }
}

/** Merge PUT answers onto previous template (v3). */
export function mergeTemplateAnswers(
    prev: KnowledgeTemplateStored | null,
    answers: Record<string, string> | undefined,
): KnowledgeTemplateStored {
    const base = prev?.genericAnswers ?? {}
    const next = { ...base }
    if (answers) {
        for (const key of STORE_VOICE_FIELD_KEYS) {
            if (key in answers) {
                const v = answers[key]
                if (typeof v === "string" && v.trim()) {
                    next[key] = v.trim()
                } else {
                    delete next[key]
                }
            }
        }
    }
    return {
        version: 3,
        genericAnswers: next,
        updatedAt: new Date().toISOString(),
    }
}
