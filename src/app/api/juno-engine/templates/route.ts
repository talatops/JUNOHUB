import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { isVendorPortalRole } from "@/lib/auth-roles"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { randomUUID } from "crypto"
import { junoTemplateCreateSchema } from "@/lib/api-schemas/vendorMutations"
import { validationErrorResponse } from "@/lib/api-schemas/validate"

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

export async function GET(req: Request) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        if (!isVendorPortalRole(session.user.role)) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 })
        }

        const url = new URL(req.url)
        const intent = url.searchParams.get("intent") || undefined
        const mood = url.searchParams.get("mood") || undefined

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            include: {
                stores: {
                    where: { isActive: true },
                    take: 1,
                    select: { id: true },
                },
            },
        })

        const activeStore = user?.stores[0]
        if (!activeStore) {
            return NextResponse.json({ templates: [] })
        }

        // Use raw SQL so we don't depend on generated Prisma delegates
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
            WHERE "storeId" = ${activeStore.id}
            ORDER BY "updatedAt" DESC
        `

        const filtered =
            intent || mood
                ? rows.filter((tpl: TemplateRow) => {
                      if (intent && tpl.intent !== intent) return false
                      if (mood && tpl.mood !== mood) return false
                      return true
                  })
                : rows

        const templates = filtered.map((tpl: TemplateRow) => ({
            ...tpl,
            variables: tpl.variables ?? undefined,
            updatedAt: tpl.updatedAt.toISOString(),
        }))

        return NextResponse.json({ templates })
    } catch (error) {
        logger.error("Failed to load templates", error)
        return NextResponse.json(
            { message: "Failed to load templates", templates: [] },
            { status: 500 },
        )
    }
}

export async function POST(req: Request) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        if (!isVendorPortalRole(session.user.role)) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 })
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            include: {
                stores: {
                    where: { isActive: true },
                    take: 1,
                    select: { id: true },
                },
            },
        })

        const activeStore = user?.stores[0]
        if (!activeStore) {
            return NextResponse.json(
                { message: "No active store found" },
                { status: 400 },
            )
        }

        const raw = await req.json().catch(() => ({}))
        const parsed = junoTemplateCreateSchema.safeParse(raw)
        if (!parsed.success) {
            return validationErrorResponse(parsed.error)
        }
        const { name, intent, mood, description, body: templateBody, variables, isHtml } =
            parsed.data

        const id = randomUUID()

        const rows = await prisma.$queryRaw<TemplateRow[]>`
            INSERT INTO "Template"
                ("id", "storeId", "name", "intent", "mood", "description", "body", "variables", "isHtml", "createdAt", "updatedAt")
            VALUES
                (${id}, ${activeStore.id}, ${name}, ${intent}, ${mood}, ${description ?? null}, ${templateBody}, ${variables as Record<string, unknown> | null}, ${isHtml ?? true}, NOW(), NOW())
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

        const inserted = rows[0]
        const template = {
            ...inserted,
            variables: inserted.variables ?? undefined,
            updatedAt: inserted.updatedAt.toISOString(),
        }

        return NextResponse.json({ template }, { status: 201 })
    } catch (error) {
        logger.error("Failed to create template", error)
        return NextResponse.json(
            { message: "Failed to create template" },
            { status: 500 },
        )
    }
}

