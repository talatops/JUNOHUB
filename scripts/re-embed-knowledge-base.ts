#!/usr/bin/env tsx
/**
 * Re-embed all KnowledgeChunk rows with OpenAI (text-embedding-3-small @ 1024 dims)
 * and tag metadata with provider openai (required for KB vector search filters).
 *
 * Usage: npm run re-embed-knowledge-base
 */

import { prisma } from "../src/lib/prisma"
import { embedBatch } from "../src/lib/kb/openaiEmbeddings"
import {
    kbEmbeddingMetadata,
    KB_EMBEDDING_DIMENSIONS,
} from "../src/lib/kb/embeddingMeta"
import { logger } from "../src/lib/logger"

const BATCH_SIZE = 32

interface KnowledgeChunkRow {
    id: string
    content: string
    storeId: string
    metadata: unknown
}

async function reEmbedKnowledgeBase() {
    try {
        logger.info("Starting knowledge base re-embedding (OpenAI)...")

        const sql = `SELECT "id", "content", "storeId", "metadata"
            FROM "KnowledgeChunk"
            WHERE "content" IS NOT NULL AND "content" != ''
            ORDER BY "createdAt" ASC`
        const chunks = await prisma.$queryRawUnsafe<KnowledgeChunkRow[]>(sql)

        if (chunks.length === 0) {
            logger.info("No knowledge chunks found to re-embed.")
            return
        }

        logger.info(`Found ${chunks.length} knowledge chunks to re-embed.`)

        let processed = 0
        let failed = 0
        const totalBatches = Math.ceil(chunks.length / BATCH_SIZE)

        for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
            const batch = chunks.slice(i, i + BATCH_SIZE)
            const batchNumber = Math.floor(i / BATCH_SIZE) + 1

            logger.info(
                `Processing batch ${batchNumber}/${totalBatches} (${batch.length} chunks)...`,
            )

            try {
                const texts = batch.map((c) => c.content)
                const embeddings = await embedBatch(texts)

                if (embeddings.length !== batch.length) {
                    logger.error(
                        `Embedding count mismatch: expected ${batch.length}, got ${embeddings.length}`,
                    )
                    failed += batch.length
                    continue
                }

                await Promise.all(
                    batch.map(async (chunk, index) => {
                        const embedding = embeddings[index]

                        if (!embedding || embedding.length === 0) {
                            logger.warn(`Skipping chunk ${chunk.id}: empty embedding`)
                            failed++
                            return
                        }

                        if (embedding.length !== KB_EMBEDDING_DIMENSIONS) {
                            logger.error(
                                `Chunk ${chunk.id}: expected ${KB_EMBEDDING_DIMENSIONS} dims, got ${embedding.length}`,
                            )
                            failed++
                            return
                        }

                        const prevMeta =
                            chunk.metadata &&
                            typeof chunk.metadata === "object" &&
                            !Array.isArray(chunk.metadata)
                                ? (chunk.metadata as Record<string, unknown>)
                                : {}
                        const nextMeta = {
                            ...prevMeta,
                            ...kbEmbeddingMetadata(),
                        }

                        try {
                            await prisma.$executeRawUnsafe(
                                `
                                UPDATE "KnowledgeChunk"
                                SET "embedding" = $1::vector,
                                    "metadata" = $2::jsonb,
                                    "updatedAt" = NOW()
                                WHERE "id" = $3
                            `,
                                `[${embedding.join(",")}]`,
                                JSON.stringify(nextMeta),
                                chunk.id,
                            )
                            processed++
                        } catch (error) {
                            logger.error(`Failed to update chunk ${chunk.id}:`, error)
                            failed++
                        }
                    }),
                )
            } catch (error) {
                logger.error(`Error processing batch ${batchNumber}:`, error)
                failed += batch.length
            }
        }

        logger.info(
            `Re-embedding completed. Processed: ${processed}, Failed: ${failed}, Total: ${chunks.length}`,
        )
    } catch (error) {
        logger.error("Fatal error during re-embedding:", error)
        process.exit(1)
    } finally {
        await prisma.$disconnect()
    }
}

if (require.main === module) {
    reEmbedKnowledgeBase()
        .then(() => {
            logger.info("Re-embedding script finished successfully.")
            process.exit(0)
        })
        .catch((error) => {
            logger.error("Re-embedding script failed:", error)
            process.exit(1)
        })
}

export { reEmbedKnowledgeBase }
