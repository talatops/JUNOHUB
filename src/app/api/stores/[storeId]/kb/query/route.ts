import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { embedBatch } from "@/lib/kb/openaiEmbeddings"
import { KB_EMBEDDING_PROVIDER } from "@/lib/kb/embeddingMeta"
import { generateKbRagAnswer } from "@/lib/kb/kbAnswer"

type QueryBody = {
    query?: string
    topK?: number
    includeFaq?: boolean
    includeDocuments?: boolean
    includeStructured?: boolean
}

type KnowledgeChunkRow = {
    id: string
    content: string
    sourceType: "DOCUMENT" | "FAQ" | "STRUCTURED"
    documentId: string | null
    faqItemId: string | null
    metadata: unknown
    similarity: number
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ storeId: string }> },
) {
    try {
        const session = await auth()

        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        const { storeId } = await params

        const store = await prisma.store.findFirst({
            where: {
                id: storeId,
                userId: session.user.id,
            },
        })

        if (!store) {
            return NextResponse.json({ message: "Store not found" }, { status: 404 })
        }

        const body = (await request.json().catch(() => ({}))) as QueryBody
        const question = body.query?.trim()
        if (!question) {
            return NextResponse.json(
                { message: "Query is required" },
                { status: 400 },
            )
        }

        const topK = Math.min(Math.max(body.topK ?? 8, 1), 20)
        const includeFaq = body.includeFaq ?? true
        const includeDocuments = body.includeDocuments ?? true
        const includeStructured = body.includeStructured ?? true

        if (!includeFaq && !includeDocuments && !includeStructured) {
            return NextResponse.json(
                {
                    message:
                        "At least one of FAQs, documents, or structured knowledge must be included",
                },
                { status: 400 },
            )
        }

        const [embedding] = await embedBatch([question])
        if (!embedding || !embedding.length) {
            return NextResponse.json(
                { message: "Failed to generate embedding for query" },
                { status: 500 },
            )
        }

        const sourceTypes: string[] = []
        if (includeFaq) sourceTypes.push("'FAQ'")
        if (includeDocuments) sourceTypes.push("'DOCUMENT'")
        if (includeStructured) sourceTypes.push("'STRUCTURED'")

        const filters: string[] = [
            '"storeId" = $1',
            `"sourceType" IN (${sourceTypes.join(", ")})`,
            `COALESCE(("metadata"::jsonb->>'provider'), '') = '${KB_EMBEDDING_PROVIDER}'`,
        ]

        const whereClause = `WHERE ${filters.join(" AND ")}`

        const chunks = await prisma.$queryRawUnsafe<KnowledgeChunkRow[]>(
            `
            SELECT 
                "id",
                "content",
                "sourceType",
                "documentId",
                "faqItemId",
                "metadata",
                1 - ("embedding" <=> '[${embedding.join(",")}]') AS similarity
            FROM "KnowledgeChunk"
            ${whereClause}
            ORDER BY "embedding" <=> '[${embedding.join(",")}]'
            LIMIT ${topK}
        `,
            store.id,
        )

        if (!chunks.length) {
            return NextResponse.json({
                answer:
                    "I could not find any relevant information in this store’s knowledge base.",
                sources: [],
            })
        }

        const contextPieces = chunks.map((chunk: KnowledgeChunkRow, index: number) => {
            const label =
                chunk.sourceType === "FAQ"
                    ? `FAQ #${index + 1}`
                    : chunk.sourceType === "STRUCTURED"
                      ? `Store profile #${index + 1}`
                      : `Document chunk #${index + 1}`
            return `${label} (similarity: ${chunk.similarity.toFixed(2)}):\n${
                chunk.content
            }`
        })

        const context = contextPieces.join("\n\n---\n\n")

        const systemPrompt =
            "You are an AI assistant helping answer customer and vendor questions for a specific store.\n" +
            "Use ONLY the provided context from the store's documents, FAQs, and structured store profile.\n" +
            "If the answer is not clearly present in the context, say that you do not know.\n" +
            "Be concise and helpful.\n"

        const userMessage = `Context:\n${context}\n\nQuestion:\n${question}`

        const { text: answer, source } = await generateKbRagAnswer(userMessage, {
            systemPrompt,
            maxTokens: 512,
        })

        if (source === "none") {
            return NextResponse.json(
                { message: "Failed to generate an answer" },
                { status: 502 },
            )
        }

        return NextResponse.json({
            answer,
            sources: chunks.map((chunk: KnowledgeChunkRow) => ({
                id: chunk.id,
                type: chunk.sourceType,
                documentId: chunk.documentId,
                faqId: chunk.faqItemId,
                similarity: chunk.similarity,
            })),
        })
    } catch (error) {
        logger.error("Error querying knowledge base", error)
        return NextResponse.json(
            { message: "Failed to query knowledge base" },
            { status: 500 },
        )
    }
}
