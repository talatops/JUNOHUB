import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { isVendorPortalRole } from "@/lib/auth-roles"
import { prisma } from "@/lib/prisma"
import { flaggedEmailCreateSchema, validationErrorResponse } from "@/lib/api-schemas"

async function getActiveStoreId(userId: string): Promise<string | null> {
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

export async function GET() {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }
        if (!isVendorPortalRole(session.user.role)) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 })
        }

        const storeId = await getActiveStoreId(session.user.id)
        if (!storeId) {
            return NextResponse.json({ flaggedEmails: [] })
        }

        const flaggedEmails = await prisma.flaggedEmail.findMany({
            where: { storeId },
            orderBy: { flaggedAt: "desc" },
        })

        type FlaggedEmailRow = (typeof flaggedEmails)[number]
        return NextResponse.json({
            flaggedEmails: flaggedEmails.map((e: FlaggedEmailRow) => ({
                id: e.id,
                subject: e.subject,
                from: e.from,
                reason: e.reason,
                priority: e.priority.toLowerCase() as "low" | "medium" | "high",
                flaggedAt: e.flaggedAt.toISOString(),
            })),
        })
    } catch (error) {
        console.error("[FLAGGED_EMAILS_GET]", error)
        return NextResponse.json(
            { message: "Failed to fetch flagged emails" },
            { status: 500 }
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

        const storeId = await getActiveStoreId(session.user.id)
        if (!storeId) {
            return NextResponse.json({ message: "No active store found" }, { status: 400 })
        }

        const raw = await req.json().catch(() => ({}))
        const parsed = flaggedEmailCreateSchema.safeParse(raw)
        if (!parsed.success) {
            return validationErrorResponse(parsed.error)
        }
        const { subject, from, reason, priority, messageId } = parsed.data

        const priorityVal = priority ?? "MEDIUM"

        const created = await prisma.flaggedEmail.create({
            data: {
                storeId,
                subject,
                from,
                reason,
                priority: priorityVal,
                messageId: messageId ?? null,
            },
        })

        return NextResponse.json({
            id: created.id,
            subject: created.subject,
            from: created.from,
            reason: created.reason,
            priority: created.priority.toLowerCase(),
            flaggedAt: created.flaggedAt.toISOString(),
        })
    } catch (error) {
        console.error("[FLAGGED_EMAILS_POST]", error)
        return NextResponse.json(
            { message: "Failed to create flagged email" },
            { status: 500 }
        )
    }
}
