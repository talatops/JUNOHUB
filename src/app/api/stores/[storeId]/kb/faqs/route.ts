import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { embedBatch } from "@/lib/kb/geminiEmbeddings"

export async function GET(
    _request: Request,
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

        const faqs = await prisma.faqItem.findMany({
            where: { storeId: store.id },
            orderBy: { createdAt: "desc" },
        })

        return NextResponse.json({ faqs })
    } catch (error) {
        logger.error("Error listing FAQs", error)
        return NextResponse.json(
            { message: "Failed to list FAQs" },
            { status: 500 },
        )
    }
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

        const body = await request.json()
        const { question, answer, tags } = body as {
            question?: string
            answer?: string
            tags?: unknown
        }

        if (!question || !answer) {
            return NextResponse.json(
                { message: "Question and answer are required" },
                { status: 400 },
            )
        }

        const faq = await prisma.faqItem.create({
            data: {
                storeId: store.id,
                question,
                answer,
                tags: tags ?? undefined,
            },
        })

        const [embedding] = await embedBatch([`${question}\n${answer}`])

        if (embedding && embedding.length) {
            await prisma.$executeRawUnsafe(
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
                faq.id,
                `${question}\n${answer}`,
                {
                    question,
                    answer,
                } as unknown as object,
            )
        }

        return NextResponse.json({ faq }, { status: 201 })
    } catch (error) {
        logger.error("Error creating FAQ", error)
        return NextResponse.json(
            { message: "Failed to create FAQ" },
            { status: 500 },
        )
    }
}

