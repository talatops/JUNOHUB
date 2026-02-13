#!/usr/bin/env tsx
/**
 * Re-embedding script for Knowledge Base
 * 
 * This script re-embeds all existing KnowledgeChunk records using AWS Bedrock
 * Titan Text Embeddings V2 (1024 dimensions) to replace Gemini embeddings (1536 dimensions).
 * 
 * Usage:
 *   npm run re-embed-knowledge-base
 *   or
 *   tsx scripts/re-embed-knowledge-base.ts
 */

import { prisma } from "../src/lib/prisma"
import { embedBatch } from "../src/lib/kb/bedrockEmbeddings"
import { logger } from "../src/lib/logger"

// AWS Bedrock Titan V2 limit: 2000 requests/minute
// Use smaller batches with delays to stay under limit
const BATCH_SIZE = 10 // Process chunks in smaller batches to avoid rate limits

interface KnowledgeChunk {
    id: string
    content: string
    storeId: string
}

async function reEmbedKnowledgeBase() {
    try {
        logger.info("Starting knowledge base re-embedding process...")

        // Fetch all knowledge chunks
        const sql = `SELECT "id", "content", "storeId"
            FROM "KnowledgeChunk"
            WHERE "content" IS NOT NULL AND "content" != ''
            ORDER BY "createdAt" ASC`
        const chunks = await prisma.$queryRawUnsafe<KnowledgeChunk[]>(sql)

        if (chunks.length === 0) {
            logger.info("No knowledge chunks found to re-embed.")
            return
        }

        logger.info(`Found ${chunks.length} knowledge chunks to re-embed.`)

        let processed = 0
        let failed = 0
        const totalBatches = Math.ceil(chunks.length / BATCH_SIZE)

        // Process in batches
        for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
            const batch = chunks.slice(i, i + BATCH_SIZE)
            const batchNumber = Math.floor(i / BATCH_SIZE) + 1

            logger.info(
                `Processing batch ${batchNumber}/${totalBatches} (${batch.length} chunks)...`,
            )

            try {
                // Generate embeddings for this batch
                const texts = batch.map((chunk) => chunk.content)
                const embeddings = await embedBatch(texts)

                if (embeddings.length !== batch.length) {
                    logger.error(
                        `Embedding count mismatch: expected ${batch.length}, got ${embeddings.length}`,
                    )
                    failed += batch.length
                    continue
                }

                // Update each chunk with its new embedding
                const updatePromises = batch.map(async (chunk, index) => {
                    const embedding = embeddings[index]

                    if (!embedding || embedding.length === 0) {
                        logger.warn(
                            `Skipping chunk ${chunk.id}: empty embedding generated`,
                        )
                        failed++
                        return
                    }

                    if (embedding.length !== 1024) {
                        logger.warn(
                            `Chunk ${chunk.id}: embedding dimension is ${embedding.length}, expected 1024`,
                        )
                        // Pad or truncate to 1024
                        if (embedding.length < 1024) {
                            embedding.push(...new Array(1024 - embedding.length).fill(0))
                        } else {
                            embedding.splice(1024)
                        }
                    }

                    try {
                        await prisma.$executeRawUnsafe(
                            `
                            UPDATE "KnowledgeChunk"
                            SET "embedding" = $1::vector(1024),
                                "updatedAt" = NOW()
                            WHERE "id" = $2
                        `,
                            `[${embedding.join(",")}]`,
                            chunk.id,
                        )
                        processed++
                    } catch (error) {
                        logger.error(`Failed to update chunk ${chunk.id}:`, error)
                        failed++
                    }
                })

                await Promise.all(updatePromises)

                logger.info(
                    `Batch ${batchNumber} completed. Processed: ${processed}, Failed: ${failed}`,
                )

                // Add delay between batches to avoid rate limiting
                // With 2s delay per request + batch processing, we need extra time between batches
                if (i + BATCH_SIZE < chunks.length) {
                    // Wait 5 seconds between batches to ensure we stay under 2000 req/min limit
                    await new Promise((resolve) => setTimeout(resolve, 5000))
                }
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

// Run the script
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
