import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { Prisma } from "@prisma/client"
import { embedBatch } from "@/lib/kb/openaiEmbeddings"
import { kbEmbeddingMetadata } from "@/lib/kb/embeddingMeta"
import {
    STORE_VOICE_FIELDS,
    parseKnowledgeTemplateJson,
    type KnowledgeTemplateStored,
} from "@/lib/kb/knowledgeTemplate"
import { parseModulePoliciesJson } from "@/lib/kb/modulePolicies"
import { parseSharedFieldAnswersJson } from "@/lib/kb/sharedFieldAnswers"
import { parseCustomAiModulesJson } from "@/lib/kb/customAiModules"
import { L1_MODULE_CUSTOMER_LABEL } from "@/lib/ai/orchestrator/vendorModuleGroups"
import { SHARED_FIELD_SHORT_LABEL } from "@/lib/ai/orchestrator/moduleThreeTypes"
import type { L1Module } from "@/lib/ai/orchestrator/types"

type StoreStructuredKnowledgeRow = {
    knowledgeBaseMode: "UNSET" | "STRUCTURED" | "DOCUMENTS"
    knowledgeTemplate: unknown
    modulePolicies: unknown
    sharedFieldAnswers: unknown
    customAiModules?: unknown
}

/**
 * Rebuild STRUCTURED knowledge chunks from the store's v3 template + modulePolicies + sharedFieldAnswers.
 * Clears STRUCTURED rows when the store is not in STRUCTURED mode.
 */
export async function replaceStructuredKnowledgeChunksForStore(storeId: string) {
    await prisma.$executeRawUnsafe(
        `DELETE FROM "KnowledgeChunk" WHERE "storeId" = $1 AND "sourceType"::text = 'STRUCTURED'`,
        storeId,
    )

    const store = (await prisma.store.findFirst({
        where: { id: storeId },
        select: {
            knowledgeBaseMode: true,
            knowledgeTemplate: true,
            modulePolicies: true,
            sharedFieldAnswers: true,
            customAiModules: true,
        } as unknown as Prisma.StoreSelect,
    })) as StoreStructuredKnowledgeRow | null

    if (!store) {
        return
    }

    const customModules = parseCustomAiModulesJson(store.customAiModules)
    const hasEnabledCustomKnowledge = customModules.some(
        (module) => module.enabled && module.answers.length > 0,
    )

    if (store.knowledgeBaseMode !== "STRUCTURED" && !hasEnabledCustomKnowledge) {
        return
    }

    const rows: {
        content: string
        metadata: ReturnType<typeof kbEmbeddingMetadata>
    }[] = []

    if (store.knowledgeBaseMode === "STRUCTURED") {
        const stored: KnowledgeTemplateStored =
            parseKnowledgeTemplateJson(store.knowledgeTemplate) ?? {
                version: 3,
                genericAnswers: {},
                updatedAt: new Date().toISOString(),
            }

        const modulePolicies = parseModulePoliciesJson(store.modulePolicies)
        const sharedFieldAnswers = parseSharedFieldAnswersJson(store.sharedFieldAnswers)

        for (const field of STORE_VOICE_FIELDS) {
            const text = stored.genericAnswers[field.key]
            if (text?.trim()) {
                rows.push({
                    content: `Q: ${field.label}\nA: ${text.trim()}`,
                    metadata: kbEmbeddingMetadata({
                        sourceKey: field.key,
                        moduleCode: "ALL",
                        fieldId: field.key,
                    }),
                })
            }
        }

        for (const [mod, text] of Object.entries(modulePolicies) as [L1Module, string][]) {
            if (!text?.trim()) continue
            const title = L1_MODULE_CUSTOMER_LABEL[mod] ?? mod
            rows.push({
                content: `Q: ${title} (store policy)\nA: ${text.trim()}`,
                metadata: kbEmbeddingMetadata({
                    sourceKey: `policy_${mod}`,
                    moduleCode: mod,
                    fieldId: `policy_${mod}`,
                }),
            })
        }

        for (const [fieldId, text] of Object.entries(sharedFieldAnswers)) {
            if (!text?.trim()) continue
            const lab = SHARED_FIELD_SHORT_LABEL[fieldId] || fieldId
            rows.push({
                content: `Q: ${lab} (${fieldId})\nA: ${text.trim()}`,
                metadata: kbEmbeddingMetadata({
                    sourceKey: fieldId,
                    moduleCode: "ALL",
                    fieldId,
                }),
            })
        }
    }

    for (const customModule of customModules) {
        if (!customModule.enabled) continue
        for (const answer of customModule.answers) {
            rows.push({
                content: [
                    `Custom module: ${customModule.title}`,
                    customModule.subtitle ? `Module subtitle: ${customModule.subtitle}` : "",
                    `Q: ${answer.subtitle}`,
                    `A: ${answer.answer}`,
                ]
                    .filter(Boolean)
                    .join("\n"),
                metadata: kbEmbeddingMetadata({
                    sourceKey: `custom_module_${customModule.id}_${answer.id}`,
                    moduleCode: "CUSTOM",
                    fieldId: answer.id,
                }),
            })
        }
    }

    if (!rows.length) {
        return
    }

    const embeddings = await embedBatch(rows.map((r) => r.content))
    if (embeddings.length !== rows.length) {
        throw new Error("Embedding count mismatch for structured template")
    }

    for (let i = 0; i < rows.length; i++) {
        const embedding = embeddings[i]!
        if (!embedding.length) {
            logger.error("Empty embedding for structured template row", { storeId, i })
            throw new Error("Failed to embed structured knowledge template")
        }
        const vectorLiteral = `'[${embedding.join(",")}]'`
        await prisma.$executeRawUnsafe(
            `
            INSERT INTO "KnowledgeChunk"
                ("id", "storeId", "documentId", "faqItemId", "sourceType", "content", "metadata", "embedding", "createdAt", "updatedAt")
            VALUES (
                gen_random_uuid()::text,
                $1,
                NULL,
                NULL,
                'STRUCTURED',
                $2,
                $3,
                ${vectorLiteral},
                NOW(),
                NOW()
            )
        `,
            storeId,
            rows[i]!.content,
            rows[i]!.metadata as unknown as object,
        )
    }
}
