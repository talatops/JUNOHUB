import { z } from "zod"
import { SHARED_FIELD_IDS } from "@/lib/kb/sharedFieldCatalog"

/** Six fixed prompts + optional misc (open-ended). Legacy v1. */
export const KNOWLEDGE_TEMPLATE_FIELD_KEYS = [
    "brandVoice",
    "shippingReturns",
    "sizingFit",
    "materialsCare",
    "policies",
    "differentiators",
] as const

export type KnowledgeTemplateFieldKey = (typeof KNOWLEDGE_TEMPLATE_FIELD_KEYS)[number]

export const KNOWLEDGE_TEMPLATE_FIELDS: {
    key: KnowledgeTemplateFieldKey
    label: string
    description: string
    placeholder: string
}[] = [
    {
        key: "brandVoice",
        label: "Brand voice and personality",
        description:
            "How should your store sound? Tone, formality, phrases to use or avoid, and what makes your brand feel human.",
        placeholder:
            "e.g. Friendly and upbeat; we say “we” and avoid slang; we’re optimistic but never pushy…",
    },
    {
        key: "shippingReturns",
        label: "Shipping, returns, and exchanges",
        description:
            "Regions you ship to, typical timelines, costs, return windows, and how customers start a return.",
        placeholder:
            "e.g. US & Canada; 3–5 business days standard; free over $75; 30-day returns via portal…",
    },
    {
        key: "sizingFit",
        label: "Sizing and fit",
        description:
            "Fit notes, size guides, model references, and how customers should choose a size.",
        placeholder:
            "e.g. True to size; relaxed fit on hoodies; see size chart on each product page…",
    },
    {
        key: "materialsCare",
        label: "Materials, care, and quality",
        description:
            "Fabrics, ingredients, durability, care instructions, and sustainability claims you stand behind.",
        placeholder:
            "e.g. 100% organic cotton; machine wash cold; hang dry; OEKO-TEX where noted…",
    },
    {
        key: "policies",
        label: "Policies customers ask about",
        description:
            "Warranty, price adjustments, pre-orders, backorders, subscriptions, or limits worth stating clearly.",
        placeholder:
            "e.g. 1-year defect warranty; no price matching; pre-orders ship when noted on the product…",
    },
    {
        key: "differentiators",
        label: "What makes your store special",
        description:
            "Differentiators, origin story, craftsmanship, community, or anything that sets you apart from competitors.",
        placeholder:
            "e.g. Small-batch, made in Portland; we donate 1% to ocean cleanup; limited seasonal drops…",
    },
]

/** Per-field answer cap (mirrored on structured KB form). */
export const KNOWLEDGE_TEMPLATE_ANSWER_MAX = 12_000
/** Misc notes cap. */
export const KNOWLEDGE_TEMPLATE_MISC_MAX = 16_000

const sharedFieldsRecordSchema = z
    .record(z.string().max(KNOWLEDGE_TEMPLATE_ANSWER_MAX))
    .optional()
    .superRefine((val, ctx) => {
        if (!val) return
        for (const k of Object.keys(val)) {
            if (!SHARED_FIELD_IDS.has(k)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: `Unknown shared field id: ${k}`,
                })
            }
        }
    })

export const knowledgeTemplatePutSchema = z.object({
    knowledgeBaseMode: z.enum(["STRUCTURED", "DOCUMENTS"]).optional(),
    confirmDestructiveSwitch: z.boolean().optional(),
    template: z
        .object({
            answers: z.record(z.string().max(KNOWLEDGE_TEMPLATE_ANSWER_MAX)).optional(),
            /** Expanded sf_* vendor policy fields (v2). */
            sharedFields: sharedFieldsRecordSchema,
            misc: z.string().max(KNOWLEDGE_TEMPLATE_MISC_MAX).optional(),
        })
        .optional(),
})

/** Normalized template for storage + embedding (v2). */
export type KnowledgeTemplateStored = {
    version: 2
    /** Legacy six-field answers (optional once migrated to shared fields). */
    legacyAnswers: Partial<Record<KnowledgeTemplateFieldKey, string>>
    /** Spec-aligned shared_field_id values. */
    sharedFields: Partial<Record<string, string>>
    misc?: string
    updatedAt: string
}

/** v1 shape as persisted historically */
type KnowledgeTemplateV1 = {
    version?: number
    answers?: Partial<Record<KnowledgeTemplateFieldKey, string>>
    misc?: string
    updatedAt?: string
}

export function normalizeTemplateAnswers(
    raw: Record<string, string> | undefined,
): Partial<Record<KnowledgeTemplateFieldKey, string>> {
    if (!raw) return {}
    const out: Partial<Record<KnowledgeTemplateFieldKey, string>> = {}
    for (const key of KNOWLEDGE_TEMPLATE_FIELD_KEYS) {
        const v = raw[key]
        if (typeof v === "string" && v.trim()) {
            out[key] = v.trim()
        }
    }
    return out
}

function normalizeSharedFields(
    raw: Record<string, string> | undefined,
): Partial<Record<string, string>> {
    if (!raw) return {}
    const out: Partial<Record<string, string>> = {}
    for (const [k, v] of Object.entries(raw)) {
        if (!SHARED_FIELD_IDS.has(k)) continue
        if (typeof v === "string" && v.trim()) {
            out[k] = v.trim()
        }
    }
    return out
}

/**
 * Coerce DB JSON to KnowledgeTemplateStored v2.
 * Migrates v1 `{ version: 1, answers }` into legacyAnswers.
 */
export function parseKnowledgeTemplateJson(json: unknown): KnowledgeTemplateStored | null {
    if (json == null || typeof json !== "object") return null
    const o = json as Record<string, unknown>
    const ver = o.version === 2 ? 2 : 1

    if (ver === 2) {
        const legacy = normalizeTemplateAnswers(
            o.legacyAnswers as Record<string, string> | undefined,
        )
        const sharedRaw = o.sharedFields
        const shared =
            sharedRaw && typeof sharedRaw === "object" && !Array.isArray(sharedRaw)
                ? normalizeSharedFields(sharedRaw as Record<string, string>)
                : {}
        const misc =
            typeof o.misc === "string" && o.misc.trim() ? o.misc.trim() : undefined
        return {
            version: 2,
            legacyAnswers: legacy,
            sharedFields: shared,
            misc,
            updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : new Date().toISOString(),
        }
    }

    const v1 = o as KnowledgeTemplateV1
    const legacy = normalizeTemplateAnswers(v1.answers as Record<string, string> | undefined)
    const misc = v1.misc?.trim() || undefined
    return {
        version: 2,
        legacyAnswers: legacy,
        sharedFields: {},
        misc,
        updatedAt: v1.updatedAt || new Date().toISOString(),
    }
}

export function buildKnowledgeTemplateStored(input: {
    answers?: Record<string, string>
    sharedFields?: Record<string, string>
    misc?: string
}): KnowledgeTemplateStored {
    return {
        version: 2,
        legacyAnswers: normalizeTemplateAnswers(input.answers),
        sharedFields: normalizeSharedFields(input.sharedFields),
        misc: input.misc?.trim() || undefined,
        updatedAt: new Date().toISOString(),
    }
}
