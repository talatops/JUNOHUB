import { z } from "zod"

/** Six fixed prompts + optional misc (open-ended). */
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

export const knowledgeTemplatePutSchema = z.object({
    knowledgeBaseMode: z.enum(["STRUCTURED", "DOCUMENTS"]).optional(),
    confirmDestructiveSwitch: z.boolean().optional(),
    template: z
        .object({
            answers: z.record(z.string().max(KNOWLEDGE_TEMPLATE_ANSWER_MAX)).optional(),
            misc: z.string().max(KNOWLEDGE_TEMPLATE_MISC_MAX).optional(),
        })
        .optional(),
})

export type KnowledgeTemplateStored = {
    version: number
    answers: Partial<Record<KnowledgeTemplateFieldKey, string>>
    misc?: string
    updatedAt: string
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
