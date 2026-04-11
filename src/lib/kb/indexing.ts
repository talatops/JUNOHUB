import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { embedBatch } from "@/lib/kb/openaiEmbeddings"
import { kbEmbeddingMetadata } from "@/lib/kb/embeddingMeta"
import type { TextChunk } from "@/lib/kb/documentProcessing"

export async function indexDocumentChunks(chunks: TextChunk[]) {
    if (chunks.length === 0) return

    const texts = chunks.map((c) => c.content)
    const embeddings = await embedBatch(texts)

    if (embeddings.length !== chunks.length) {
        throw new Error("Embedding count does not match chunk count")
    }

    // Convert JS arrays to Postgres vector via raw SQL
    const values = chunks.map((chunk, idx) => {
        const embedding = embeddings[idx]
        const vectorLiteral = embedding.length ? `'[${embedding.join(",")}]'` : "NULL"
        const metadata = {
            ...chunk.metadata,
            ...kbEmbeddingMetadata(),
        }

        return prisma.$executeRawUnsafe(
            `
            INSERT INTO "KnowledgeChunk" 
                ("id", "storeId", "documentId", "sourceType", "content", "metadata", "embedding", "createdAt", "updatedAt")
            VALUES (
                gen_random_uuid()::text,
                $1,
                $2,
                'DOCUMENT',
                $3,
                $4,
                ${vectorLiteral},
                NOW(),
                NOW()
            )
        `,
            chunk.storeId,
            chunk.documentId,
            chunk.content,
            metadata as unknown as object,
        )
    })

    try {
        await Promise.all(values)
    } catch (error) {
        logger.error("Failed to insert knowledge chunks", error)
        throw error
    }
}

