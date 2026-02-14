import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

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
        if (session.user.role !== "VENDOR") {
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

        return NextResponse.json({
            flaggedEmails: flaggedEmails.map((e) => ({
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
        if (session.user.role !== "VENDOR") {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 })
        }

        const storeId = await getActiveStoreId(session.user.id)
        if (!storeId) {
            return NextResponse.json({ message: "No active store found" }, { status: 400 })
        }

        const body = await req.json()
        const { subject, from, reason, priority, messageId } = body as {
            subject?: string
            from?: string
            reason?: string
            priority?: "LOW" | "MEDIUM" | "HIGH"
            messageId?: string
        }

        if (!subject || !from || !reason) {
            return NextResponse.json(
                { message: "subject, from, and reason are required" },
                { status: 400 }
            )
        }

        const priorityVal = priority && ["LOW", "MEDIUM", "HIGH"].includes(priority)
            ? priority
            : "MEDIUM"

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
