import fs from "fs/promises"
import path from "path"
import type { PrismaClient } from "@prisma/client"
import { logger } from "@/lib/logger"

export async function deleteDocumentKbForStore(
    prisma: PrismaClient,
    storeId: string,
) {
    const docs = await prisma.$queryRawUnsafe<{ id: string; storagePath: string }[]>(
        `SELECT "id", "storagePath" FROM "KnowledgeDocument" WHERE "storeId" = $1`,
        storeId,
    )
    for (const d of docs) {
        try {
            await fs.unlink(path.resolve(d.storagePath))
        } catch (e) {
            logger.warn("Failed to delete KB file on disk", {
                path: d.storagePath,
                message: e instanceof Error ? e.message : String(e),
            })
        }
    }
    await prisma.$executeRawUnsafe(
        `DELETE FROM "KnowledgeChunk" WHERE "storeId" = $1 AND "sourceType"::text = 'DOCUMENT'`,
        storeId,
    )
    await prisma.$executeRawUnsafe(
        `DELETE FROM "KnowledgeDocument" WHERE "storeId" = $1`,
        storeId,
    )
}

export async function deleteFaqKbForStore(prisma: PrismaClient, storeId: string) {
    await prisma.$executeRawUnsafe(
        `DELETE FROM "KnowledgeChunk" WHERE "storeId" = $1 AND "sourceType"::text = 'FAQ'`,
        storeId,
    )
    await prisma.faqItem.deleteMany({ where: { storeId } })
}

export async function deleteStructuredKbForStore(
    prisma: PrismaClient,
    storeId: string,
) {
    await prisma.$executeRawUnsafe(
        `DELETE FROM "KnowledgeChunk" WHERE "storeId" = $1 AND "sourceType"::text = 'STRUCTURED'`,
        storeId,
    )
}
