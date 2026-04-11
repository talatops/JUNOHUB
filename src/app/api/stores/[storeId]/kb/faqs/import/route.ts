import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { embedBatch } from "@/lib/kb/openaiEmbeddings"
import { kbEmbeddingMetadata } from "@/lib/kb/embeddingMeta"
import type { FaqItem } from "@prisma/client"
import { kbFaqImportArraySchema, validationErrorResponse } from "@/lib/api-schemas"

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

        if (store.knowledgeBaseMode === "STRUCTURED") {
            return NextResponse.json(
                {
                    message:
                        "FAQ import is disabled while using structured knowledge. Switch to document-based knowledge in Settings.",
                },
                { status: 409 },
            )
        }

        let items: unknown[] = []

        const contentType = request.headers.get("content-type") || ""
        if (contentType.includes("application/json")) {
            const body = await request.json()
            if (!Array.isArray(body)) {
                return NextResponse.json(
                    { message: "JSON body must be an array of FAQs" },
                    { status: 400 },
                )
            }
            items = body
        } else if (contentType.includes("multipart/form-data")) {
            const formData = await request.formData()
            const file = formData.get("file")
            if (!(file instanceof File)) {
                return NextResponse.json(
                    { message: "Missing file field 'file'" },
                    { status: 400 },
                )
            }
            const text = await file.text()
            try {
                const parsed = JSON.parse(text)
                if (!Array.isArray(parsed)) {
                    return NextResponse.json(
                        { message: "JSON must be an array of FAQs" },
                        { status: 400 },
                    )
                }
                items = parsed
            } catch {
                return NextResponse.json(
                    { message: "Invalid JSON in uploaded file" },
                    { status: 400 },
                )
            }
        } else {
            return NextResponse.json(
                { message: "Unsupported content type" },
                { status: 400 },
            )
        }

        const validated = kbFaqImportArraySchema.safeParse(items)
        if (!validated.success) {
            return validationErrorResponse(validated.error)
        }
        const validItems = validated.data

        const createdFaqs = await prisma.$transaction(
            validItems.map((item) =>
                prisma.faqItem.create({
                    data: {
                        storeId: store.id,
                        question: item.question,
                        answer: item.answer,
                        tags: item.tags ?? undefined,
                    },
                }),
            ),
        )

        const texts = createdFaqs.map(
            (faq: { question: string; answer: string }) => `${faq.question}\n${faq.answer}`,
        )
        const embeddings = await embedBatch(texts)

        await Promise.all(
            createdFaqs.map((faq: FaqItem, index: number) => {
                const embedding = embeddings[index]
                if (!embedding || !embedding.length) return Promise.resolve()

                return prisma.$executeRawUnsafe(
                    `
                    INSERT INTO "KnowledgeChunk"
                        ("id", "storeId", "faqItemId", "sourceType", "content", "metadata", "embedding", "createdAt", "updatedAt")
                    VALUES (
                        gen_random_uuid()::text,
                        $1,
                        $2,
                        'FAQ',
                        $3,
                        $4,
                        '[${embedding.join(",")}]',
                        NOW(),
                        NOW()
                    )
                `,
                    faq.storeId,
                    faq.id as string,
                    `${faq.question}\n${faq.answer}`,
                    {
                        question: faq.question,
                        answer: faq.answer,
                        ...kbEmbeddingMetadata(),
                    } as unknown as object,
                )
            }),
        )

        return NextResponse.json(
            { imported: createdFaqs.length },
            { status: 201 },
        )
    } catch (error) {
        logger.error("Error importing FAQs", error)
        return NextResponse.json(
            { message: "Failed to import FAQs" },
            { status: 500 },
        )
    }
}

