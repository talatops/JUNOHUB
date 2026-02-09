import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { processRawDocument } from "@/lib/kb/documentProcessing"
import { indexDocumentChunks } from "@/lib/kb/indexing"
import path from "path"
import fs from "fs/promises"
import { randomUUID } from "crypto"

const UPLOAD_DIR = process.env.KB_UPLOAD_DIR || "uploads/kb"

async function ensureUploadDir() {
    const absolute = path.resolve(UPLOAD_DIR)
    await fs.mkdir(absolute, { recursive: true })
    return absolute
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

        const formData = await request.formData()
        const file = formData.get("file")

        if (!(file instanceof File)) {
            return NextResponse.json(
                { message: "Missing file field 'file'" },
                { status: 400 },
            )
        }

        const mimeType = file.type || "application/octet-stream"
        const originalName = file.name || "document"

        if (
            ![
                "application/pdf",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "application/msword",
            ].includes(mimeType)
        ) {
            return NextResponse.json(
                { message: "Only PDF and DOCX files are supported" },
                { status: 400 },
            )
        }

        const uploadDir = await ensureUploadDir()
        const id = randomUUID()
        const fileNameOnDisk = `${id}-${originalName}`
        const storagePath = path.join(uploadDir, fileNameOnDisk)

        const arrayBuffer = await file.arrayBuffer()
        await fs.writeFile(storagePath, Buffer.from(arrayBuffer))

        const sizeBytes = Buffer.byteLength(Buffer.from(arrayBuffer))

        // Insert document via raw SQL to avoid relying on generated model delegates
        await prisma.$executeRawUnsafe(
            `
            INSERT INTO "KnowledgeDocument"
                ("id", "storeId", "title", "fileName", "mimeType", "sizeBytes", "status", "errorMessage", "storagePath", "createdAt", "updatedAt")
            VALUES ($1, $2, $3, $4, $5, $6, 'PROCESSING', NULL, $7, NOW(), NOW())
        `,
            id,
            store.id,
            originalName,
            originalName,
            mimeType,
            sizeBytes,
            storagePath,
        )

        const [document] = (await prisma.$queryRawUnsafe<
            {
                id: string
                storeId: string
                title: string
                fileName: string
                mimeType: string
                sizeBytes: number
                status: string
                storagePath: string
            }[]
        >(
            `
            SELECT "id", "storeId", "title", "fileName", "mimeType", "sizeBytes", "status", "storagePath"
            FROM "KnowledgeDocument"
            WHERE "id" = $1
        `,
            id,
        )) ?? []

        // Process and index inline for now; can be moved to a background job later
        try {
            const chunks = await processRawDocument({
                id: document.id,
                storeId: document.storeId,
                storagePath: document.storagePath,
                mimeType: document.mimeType,
            })

            await indexDocumentChunks(chunks)

            await prisma.$executeRawUnsafe(
                `
                UPDATE "KnowledgeDocument"
                SET "status" = 'READY',
                    "errorMessage" = NULL,
                    "updatedAt" = NOW()
                WHERE "id" = $1
            `,
                document.id,
            )
        } catch (error) {
            logger.error("Failed to process knowledge document", error)
            await prisma.$executeRawUnsafe(
                `
                UPDATE "KnowledgeDocument"
                SET "status" = 'FAILED',
                    "errorMessage" = $2,
                    "updatedAt" = NOW()
                WHERE "id" = $1
            `,
                document.id,
                error instanceof Error ? error.message : "Unknown error",
            )
        }

        return NextResponse.json(
            {
                success: true,
                document: {
                    id: document.id,
                    title: document.title,
                    status: document.status,
                },
            },
            { status: 201 },
        )
    } catch (error) {
        logger.error("Error uploading knowledge base document", error)
        return NextResponse.json(
            { message: "Failed to upload document" },
            { status: 500 },
        )
    }
}

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

        const documents = await prisma.$queryRawUnsafe<
            {
                id: string
                title: string
                fileName: string
                mimeType: string
                sizeBytes: number
                status: string
                createdAt: Date
                updatedAt: Date
            }[]
        >(
            `
            SELECT "id", "title", "fileName", "mimeType", "sizeBytes", "status", "createdAt", "updatedAt"
            FROM "KnowledgeDocument"
            WHERE "storeId" = $1
            ORDER BY "createdAt" DESC
        `,
            store.id,
        )

        return NextResponse.json({ documents })
    } catch (error) {
        logger.error("Error listing knowledge base documents", error)
        return NextResponse.json(
            { message: "Failed to list documents" },
            { status: 500 },
        )
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ storeId: string }> },
) {
    try {
        const session = await auth()

        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        const { storeId } = await params
        const { searchParams } = new URL(request.url)
        const documentId = searchParams.get("id")

        if (!documentId) {
            return NextResponse.json(
                { message: "Document ID is required" },
                { status: 400 },
            )
        }

        const store = await prisma.store.findFirst({
            where: {
                id: storeId,
                userId: session.user.id,
            },
        })

        if (!store) {
            return NextResponse.json({ message: "Store not found" }, { status: 404 })
        }

        // Ensure the document belongs to this store
        const [doc] = (await prisma.$queryRawUnsafe<
            { id: string; storeId: string }[]
        >(
            `
            SELECT "id", "storeId"
            FROM "KnowledgeDocument"
            WHERE "id" = $1 AND "storeId" = $2
        `,
            documentId,
            store.id,
        )) ?? []

        if (!doc) {
            return NextResponse.json(
                { message: "Document not found" },
                { status: 404 },
            )
        }

        // Delete associated chunks first, then the document
        await prisma.$executeRawUnsafe(
            `DELETE FROM "KnowledgeChunk" WHERE "documentId" = $1`,
            documentId,
        )
        await prisma.$executeRawUnsafe(
            `DELETE FROM "KnowledgeDocument" WHERE "id" = $1`,
            documentId,
        )

        return NextResponse.json({ success: true })
    } catch (error) {
        logger.error("Error deleting knowledge base document", error)
        return NextResponse.json(
            { message: "Failed to delete document" },
            { status: 500 },
        )
    }
}

