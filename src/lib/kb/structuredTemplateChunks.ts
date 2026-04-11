import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { embedBatch } from "@/lib/kb/openaiEmbeddings"
import { kbEmbeddingMetadata } from "@/lib/kb/embeddingMeta"
import {
    KNOWLEDGE_TEMPLATE_FIELDS,
    type KnowledgeTemplateStored,
} from "@/lib/kb/knowledgeTemplate"

export async function replaceStructuredKnowledgeChunks(
    storeId: string,
    stored: KnowledgeTemplateStored,
) {
    await prisma.$executeRawUnsafe(
        `DELETE FROM "KnowledgeChunk" WHERE "storeId" = $1 AND "sourceType"::text = 'STRUCTURED'`,
        storeId,
    )

    const rows: { content: string; metadata: ReturnType<typeof kbEmbeddingMetadata> }[] =
        []

    for (const field of KNOWLEDGE_TEMPLATE_FIELDS) {
        const text = stored.answers[field.key]
        if (text?.trim()) {
            rows.push({
                content: `Q: ${field.label}\nA: ${text.trim()}`,
                metadata: kbEmbeddingMetadata({ sourceKey: field.key }),
            })
        }
    }

    if (stored.misc?.trim()) {
        rows.push({
            content: `Q: Anything else customers should know\nA: ${stored.misc.trim()}`,
            metadata: kbEmbeddingMetadata({ sourceKey: "misc" }),
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
