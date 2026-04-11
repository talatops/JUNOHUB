import { z } from "zod"
import { KNOWLEDGE_TEMPLATE_ANSWER_MAX } from "@/lib/kb/knowledgeTemplate"

const SF_KEY = /^sf_[a-z0-9_]+$/

/** PATCH body for `sharedFieldAnswers` on Store. */
export const sharedFieldAnswersBodySchema = z
    .record(z.string().max(KNOWLEDGE_TEMPLATE_ANSWER_MAX))
    .superRefine((val, ctx) => {
        for (const k of Object.keys(val)) {
            if (!SF_KEY.test(k)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: `Invalid shared field key: ${k}`,
                })
            }
        }
    })

export function parseSharedFieldAnswersJson(raw: unknown): Record<string, string> {
    if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
        return {}
    }
    const o = raw as Record<string, unknown>
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(o)) {
        if (!SF_KEY.test(k)) continue
        if (typeof v === "string" && v.trim()) {
            out[k] = v.trim()
        }
    }
    return out
}

export function sharedFieldAnswersPayload(
    answers: Record<string, string>,
): Record<string, string> {
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(answers)) {
        if (!SF_KEY.test(k)) continue
        const t = v.trim()
        if (t) out[k] = t.slice(0, KNOWLEDGE_TEMPLATE_ANSWER_MAX)
    }
    return out
}
