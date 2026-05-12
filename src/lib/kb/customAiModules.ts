import { z } from "zod"
import { KNOWLEDGE_TEMPLATE_ANSWER_MAX } from "@/lib/kb/knowledgeTemplate"

const CUSTOM_MODULE_ID = /^custom_[a-z0-9_-]{6,80}$/
const CUSTOM_ANSWER_ID = /^answer_[a-z0-9_-]{4,80}$/
const TITLE_MAX = 80
const SUBTITLE_MAX = 160
const MAX_CUSTOM_MODULES = 30
const MAX_ANSWERS_PER_MODULE = 12

export type CustomAiModuleAnswer = {
    id: string
    subtitle: string
    answer: string
}

export type CustomAiModule = {
    id: string
    title: string
    subtitle: string
    enabled: boolean
    answers: CustomAiModuleAnswer[]
    createdAt?: string
    updatedAt?: string
}

export const customAiModulesBodySchema = z
    .array(
        z.object({
            id: z.string().regex(CUSTOM_MODULE_ID),
            title: z.string().max(TITLE_MAX),
            subtitle: z.string().max(SUBTITLE_MAX).optional().default(""),
            enabled: z.boolean().optional().default(true),
            answers: z
                .array(
                    z.object({
                        id: z.string().regex(CUSTOM_ANSWER_ID),
                        subtitle: z.string().max(SUBTITLE_MAX),
                        answer: z.string().max(KNOWLEDGE_TEMPLATE_ANSWER_MAX),
                    }),
                )
                .max(MAX_ANSWERS_PER_MODULE)
                .optional()
                .default([]),
            createdAt: z.string().optional(),
            updatedAt: z.string().optional(),
        }),
    )
    .max(MAX_CUSTOM_MODULES)

function cleanText(value: unknown, max: number) {
    return typeof value === "string" ? value.trim().slice(0, max) : ""
}

export function parseCustomAiModulesJson(raw: unknown): CustomAiModule[] {
    if (!Array.isArray(raw)) return []

    const out: CustomAiModule[] = []
    const seen = new Set<string>()
    for (const item of raw) {
        if (!item || typeof item !== "object") continue
        const row = item as Record<string, unknown>
        const id = cleanText(row.id, 96)
        if (!CUSTOM_MODULE_ID.test(id) || seen.has(id)) continue
        seen.add(id)

        const title = cleanText(row.title, TITLE_MAX)
        if (!title) continue

        const answers: CustomAiModuleAnswer[] = []
        const seenAnswers = new Set<string>()
        const rawAnswers = Array.isArray(row.answers) ? row.answers : []
        for (const answerRow of rawAnswers) {
            if (!answerRow || typeof answerRow !== "object") continue
            const answer = answerRow as Record<string, unknown>
            const answerId = cleanText(answer.id, 96)
            if (!CUSTOM_ANSWER_ID.test(answerId) || seenAnswers.has(answerId)) continue
            seenAnswers.add(answerId)

            const subtitle = cleanText(answer.subtitle, SUBTITLE_MAX)
            const body = cleanText(answer.answer, KNOWLEDGE_TEMPLATE_ANSWER_MAX)
            if (!subtitle || !body) continue
            answers.push({ id: answerId, subtitle, answer: body })
            if (answers.length >= MAX_ANSWERS_PER_MODULE) break
        }

        out.push({
            id,
            title,
            subtitle: cleanText(row.subtitle, SUBTITLE_MAX),
            enabled: row.enabled !== false,
            answers,
            createdAt: cleanText(row.createdAt, 40) || undefined,
            updatedAt: cleanText(row.updatedAt, 40) || undefined,
        })
        if (out.length >= MAX_CUSTOM_MODULES) break
    }

    return out
}

export function customAiModulesPayload(modules: CustomAiModule[]): CustomAiModule[] {
    const now = new Date().toISOString()
    return parseCustomAiModulesJson(
        modules.map((module) => ({
            ...module,
            updatedAt: now,
            createdAt: module.createdAt || now,
        })),
    )
}
