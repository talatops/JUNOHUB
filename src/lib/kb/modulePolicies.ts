import { z } from "zod"
import type { L1Module } from "@/lib/ai/orchestrator/types"
import { L1_MODULE_IDS } from "@/lib/ai/orchestrator/types"
import { KNOWLEDGE_TEMPLATE_ANSWER_MAX } from "@/lib/kb/knowledgeTemplate"

/** Full body for PATCH /api/stores/[storeId] `modulePolicies`. */
export const modulePoliciesBodySchema = z
    .record(z.string().max(KNOWLEDGE_TEMPLATE_ANSWER_MAX))
    .superRefine((val, ctx) => {
        for (const k of Object.keys(val)) {
            if (!L1_MODULE_IDS.includes(k as L1Module)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: `Unknown module key: ${k}`,
                })
            }
        }
    })

export function parseModulePoliciesJson(
    raw: unknown,
): Partial<Record<L1Module, string>> {
    if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
        return {}
    }
    const o = raw as Record<string, unknown>
    const out: Partial<Record<L1Module, string>> = {}
    for (const id of L1_MODULE_IDS) {
        const v = o[id]
        if (typeof v === "string" && v.trim()) {
            out[id] = v.trim()
        }
    }
    return out
}
