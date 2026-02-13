import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"

type TemplateRow = {
    id: string
    storeId: string
    name: string
    intent: string
    mood: string
    description: string | null
    body: string
    variables: unknown | null
    isHtml: boolean
    updatedAt: Date
}

async function getActiveStoreId(userId: string) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
            stores: {
                where: { isActive: true },
                take: 1,
                select: { id: true },
            },
        },
    })

    return user?.stores[0]?.id ?? null
}

export async function GET(
    _req: Request,
    { params }: { params: Promise<{ templateId: string }> },
) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        if (session.user.role !== "VENDOR") {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 })
        }

        const { templateId } = await params

        const storeId = await getActiveStoreId(session.user.id)
        if (!storeId) {
            return NextResponse.json(
                { message: "No active store found" },
                { status: 400 },
            )
        }

        const rows = await prisma.$queryRaw<TemplateRow[]>`
            SELECT
                "id",
                "storeId",
                "name",
                "intent",
                "mood",
                "description",
                "body",
                "variables",
                "isHtml",
                "updatedAt"
            FROM "Template"
            WHERE "id" = ${templateId} AND "storeId" = ${storeId}
            LIMIT 1
        `

        const row = rows[0]

        if (!row) {
            return NextResponse.json({ message: "Template not found" }, { status: 404 })
        }

        const template = {
            ...row,
            variables: row.variables ?? undefined,
            updatedAt: row.updatedAt.toISOString(),
        }

        return NextResponse.json({ template })
    } catch (error) {
        logger.error("Failed to load template", error)
        return NextResponse.json(
            { message: "Failed to load template" },
            { status: 500 },
        )
    }
}

export async function PUT(
    req: Request,
    { params }: { params: Promise<{ templateId: string }> },
) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        if (session.user.role !== "VENDOR") {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 })
        }

        const { templateId } = await params

        const storeId = await getActiveStoreId(session.user.id)
        if (!storeId) {
            return NextResponse.json(
                { message: "No active store found" },
                { status: 400 },
            )
        }

        const existingRows = await prisma.$queryRaw<Pick<TemplateRow, "id">[]>`
            SELECT "id"
            FROM "Template"
            WHERE "id" = ${templateId} AND "storeId" = ${storeId}
            LIMIT 1
        `
        const existing = existingRows[0]
        if (!existing) {
            return NextResponse.json({ message: "Template not found" }, { status: 404 })
        }

        const body = await req.json().catch(() => null)
        if (!body) {
            return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 })
        }

        const {
            name,
            intent,
            mood,
            description,
            body: templateBody,
            variables,
            isHtml,
        } = body as {
            name?: string
            intent?: string
            mood?: string
            description?: string | null
            body?: string
            variables?: unknown
            isHtml?: boolean
        }

        const rows = await prisma.$queryRaw<TemplateRow[]>`
            UPDATE "Template"
            SET
                "name" = COALESCE(${name}, "name"),
                "intent" = COALESCE(${intent}, "intent"),
                "mood" = COALESCE(${mood}, "mood"),
                "description" = COALESCE(${description ?? null}, "description"),
                "body" = COALESCE(${templateBody}, "body"),
                "variables" = COALESCE(${variables as any}, "variables"),
                "isHtml" = COALESCE(${isHtml}, "isHtml"),
                "updatedAt" = NOW()
            WHERE "id" = ${existing.id}
            RETURNING
                "id",
                "storeId",
                "name",
                "intent",
                "mood",
                "description",
                "body",
                "variables",
                "isHtml",
                "updatedAt"
        `

        const row = rows[0]
        const updated = {
            ...row,
            variables: row.variables ?? undefined,
            updatedAt: row.updatedAt.toISOString(),
        }

        return NextResponse.json({ template: updated })
    } catch (error) {
        logger.error("Failed to update template", error)
        return NextResponse.json(
            { message: "Failed to update template" },
            { status: 500 },
        )
    }
}

export async function DELETE(
    _req: Request,
    { params }: { params: Promise<{ templateId: string }> },
) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        if (session.user.role !== "VENDOR") {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 })
        }

        const { templateId } = await params

        const storeId = await getActiveStoreId(session.user.id)
        if (!storeId) {
            return NextResponse.json(
                { message: "No active store found" },
                { status: 400 },
            )
        }

        const existingRows = await prisma.$queryRaw<Pick<TemplateRow, "id">[]>`
            SELECT "id"
            FROM "Template"
            WHERE "id" = ${templateId} AND "storeId" = ${storeId}
            LIMIT 1
        `
        const existing = existingRows[0]
        if (!existing) {
            return NextResponse.json({ message: "Template not found" }, { status: 404 })
        }

        await prisma.$executeRaw`
            DELETE FROM "Template"
            WHERE "id" = ${existing.id}
        `

        return NextResponse.json({ success: true })
    } catch (error) {
        logger.error("Failed to delete template", error)
        return NextResponse.json(
            { message: "Failed to delete template" },
            { status: 500 },
        )
    }
}

