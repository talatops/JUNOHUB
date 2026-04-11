import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { embedBatch } from "@/lib/kb/openaiEmbeddings"
import { kbEmbeddingMetadata } from "@/lib/kb/embeddingMeta"
import {
    KNOWLEDGE_TEMPLATE_FIELDS,
    type KnowledgeTemplateStored,
} from "@/lib/kb/knowledgeTemplate"
import { SHARED_FIELD_CATALOG } from "@/lib/kb/sharedFieldCatalog"

export async function replaceStructuredKnowledgeChunks(
    storeId: string,
    stored: KnowledgeTemplateStored,
) {
    await prisma.$executeRawUnsafe(
        `DELETE FROM "KnowledgeChunk" WHERE "storeId" = $1 AND "sourceType"::text = 'STRUCTURED'`,
        storeId,
    )

    const rows: {
        content: string
        metadata: ReturnType<typeof kbEmbeddingMetadata>
    }[] = []

    for (const field of KNOWLEDGE_TEMPLATE_FIELDS) {
        const text = stored.legacyAnswers[field.key]
        if (text?.trim()) {
            rows.push({
                content: `Q: ${field.label}\nA: ${text.trim()}`,
                metadata: kbEmbeddingMetadata({
                    sourceKey: field.key,
                    moduleCode: "LEGACY",
                    fieldId: field.key,
                }),
            })
        }
    }

    const catalogById = new Map(SHARED_FIELD_CATALOG.map((f) => [f.id, f]))
    for (const [id, text] of Object.entries(stored.sharedFields)) {
        const trimmed = text?.trim()
        if (!trimmed) continue
        const def = catalogById.get(id)
        const label = def?.label ?? id
        const moduleCode = def?.group ?? "FAQ"
        rows.push({
            content: `Q: ${label}\nA: ${trimmed}`,
            metadata: kbEmbeddingMetadata({
                sourceKey: id,
                moduleCode,
                fieldId: id,
            }),
        })
    }

    if (stored.misc?.trim()) {
        rows.push({
            content: `Q: Anything else customers should know\nA: ${stored.misc.trim()}`,
            metadata: kbEmbeddingMetadata({
                sourceKey: "misc",
                moduleCode: "ALL",
                fieldId: "misc",
            }),
        })
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
