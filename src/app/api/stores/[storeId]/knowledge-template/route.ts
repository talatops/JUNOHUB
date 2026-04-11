import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import {
    knowledgeTemplatePutSchema,
    normalizeTemplateAnswers,
    type KnowledgeTemplateStored,
} from "@/lib/kb/knowledgeTemplate"
import { replaceStructuredKnowledgeChunks } from "@/lib/kb/structuredTemplateChunks"
import {
    deleteDocumentKbForStore,
    deleteFaqKbForStore,
    deleteStructuredKbForStore,
} from "@/lib/kb/storeKbCleanup"
import { Prisma, type KnowledgeBaseMode } from "@prisma/client"

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
            where: { id: storeId, userId: session.user.id },
            select: {
                id: true,
                knowledgeBaseMode: true,
                knowledgeTemplate: true,
            },
        })

        if (!store) {
            return NextResponse.json({ message: "Store not found" }, { status: 404 })
        }

        const [documentCount, faqCount, structuredChunkCount] = await Promise.all([
            prisma.knowledgeDocument.count({ where: { storeId: store.id } }),
            prisma.faqItem.count({ where: { storeId: store.id } }),
            prisma.knowledgeChunk.count({
                where: { storeId: store.id, sourceType: "STRUCTURED" },
            }),
        ])

        return NextResponse.json({
            knowledgeBaseMode: store.knowledgeBaseMode,
            knowledgeTemplate: store.knowledgeTemplate,
            counts: {
                documents: documentCount,
                faqs: faqCount,
                structuredChunks: structuredChunkCount,
            },
        })
    } catch (error) {
        logger.error("GET knowledge-template error", error)
        return NextResponse.json(
            { message: "Failed to load knowledge template" },
            { status: 500 },
        )
    }
}

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ storeId: string }> },
) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        const { storeId } = await params
        let store = await prisma.store.findFirst({
            where: { id: storeId, userId: session.user.id },
        })

        if (!store) {
            return NextResponse.json({ message: "Store not found" }, { status: 404 })
        }

        const json = await request.json().catch(() => null)
        const parsed = knowledgeTemplatePutSchema.safeParse(json)
        if (!parsed.success) {
            return NextResponse.json(
                { message: "Invalid body", issues: parsed.error.flatten() },
                { status: 400 },
            )
        }

        const body = parsed.data
        const confirm = body.confirmDestructiveSwitch === true

        const docCount = await prisma.knowledgeDocument.count({
            where: { storeId: store.id },
        })
        const faqCount = await prisma.faqItem.count({ where: { storeId: store.id } })
        const structuredCount = await prisma.knowledgeChunk.count({
            where: { storeId: store.id, sourceType: "STRUCTURED" },
        })
        const hasTemplateJson = store.knowledgeTemplate != null

        if (body.knowledgeBaseMode !== undefined) {
            const target = body.knowledgeBaseMode as KnowledgeBaseMode
            if (target !== store.knowledgeBaseMode) {
                if (target === "STRUCTURED") {
                    const destructive = docCount > 0 || faqCount > 0
                    if (destructive && !confirm) {
                        return NextResponse.json(
                            {
                                message:
                                    "Switching to structured knowledge will remove uploaded documents and FAQs. Send confirmDestructiveSwitch: true to proceed.",
                                code: "CONFIRM_REQUIRED",
                            },
                            { status: 400 },
                        )
                    }
                    if (destructive) {
                        await deleteDocumentKbForStore(prisma, store.id)
                        await deleteFaqKbForStore(prisma, store.id)
                    }
                    await prisma.store.update({
                        where: { id: store.id },
                        data: { knowledgeBaseMode: "STRUCTURED" },
                    })
                } else if (target === "DOCUMENTS") {
                    const destructive = structuredCount > 0 || hasTemplateJson
                    if (destructive && !confirm) {
                        return NextResponse.json(
                            {
                                message:
                                    "Switching to document-based knowledge will remove your structured profile and its embeddings. Send confirmDestructiveSwitch: true to proceed.",
                                code: "CONFIRM_REQUIRED",
                            },
                            { status: 400 },
                        )
                    }
                    await deleteStructuredKbForStore(prisma, store.id)
                    await prisma.store.update({
                        where: { id: store.id },
                        data: {
                            knowledgeBaseMode: "DOCUMENTS",
                            knowledgeTemplate: Prisma.JsonNull,
                        },
                    })
                }
            }
        }

        store = await prisma.store.findFirstOrThrow({
            where: { id: store.id, userId: session.user.id },
        })

        if (body.template !== undefined) {
            if (store.knowledgeBaseMode === "DOCUMENTS") {
                return NextResponse.json(
                    {
                        message:
                            "This store uses document-based knowledge. Switch to structured knowledge before editing the template.",
                    },
                    { status: 409 },
                )
            }

            const answers = normalizeTemplateAnswers(body.template.answers)
            const misc = body.template.misc?.trim() || undefined

            const stored: KnowledgeTemplateStored = {
                version: 1,
                answers,
                misc,
                updatedAt: new Date().toISOString(),
            }

            const nextMode: KnowledgeBaseMode =
                store.knowledgeBaseMode === "UNSET" ? "STRUCTURED" : store.knowledgeBaseMode

            await prisma.store.update({
                where: { id: store.id },
                data: {
                    knowledgeBaseMode: nextMode,
                    knowledgeTemplate: stored as object,
                },
            })

            await replaceStructuredKnowledgeChunks(store.id, stored)
        }

        const refreshed = await prisma.store.findFirst({
            where: { id: store.id },
            select: {
                knowledgeBaseMode: true,
                knowledgeTemplate: true,
            },
        })

        return NextResponse.json({
            success: true,
            knowledgeBaseMode: refreshed?.knowledgeBaseMode,
            knowledgeTemplate: refreshed?.knowledgeTemplate,
        })
    } catch (error) {
        logger.error("PUT knowledge-template error", error)
        return NextResponse.json(
            { message: "Failed to save knowledge template" },
            { status: 500 },
        )
    }
}
