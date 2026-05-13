import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { isVendorPortalRole } from "@/lib/auth-roles"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { getTicketThreadForStore } from "@/lib/tickets/emailLogTickets"

export async function GET(
    request: Request,
    { params }: { params: Promise<{ ticketId: string }> },
) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }
        if (!isVendorPortalRole(session.user.role)) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 })
        }

        const resolved = await params
        const ticketId = decodeURIComponent(resolved.ticketId || "")
        const { searchParams } = new URL(request.url)
        const before = searchParams.get("before")
        const limit = Math.min(
            Math.max(Number.parseInt(searchParams.get("limit") || "50", 10) || 50, 1),
            200,
        )
        if (!ticketId) {
            return NextResponse.json({ message: "Invalid ticket id" }, { status: 400 })
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
            return NextResponse.json({ message: "No active store" }, { status: 400 })
        }

        const ticket = await getTicketThreadForStore(activeStore.id, ticketId)
        if (!ticket) {
            return NextResponse.json({ message: "Ticket not found" }, { status: 404 })
        }

        const sorted = [...ticket.messages].sort(
            (a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime(),
        )
        const offset =
            before != null
                ? Math.max(
                      sorted.findIndex((m) => m.id === before) + 1,
                      0,
                  )
                : 0
        const page = sorted.slice(offset, offset + limit)
        const nextCursor =
            offset + limit < sorted.length ? page[page.length - 1]?.id || null : null

        return NextResponse.json({
            ticket: {
                ...ticket,
                messages: page,
            },
            nextCursor,
            totalMessages: sorted.length,
        })
    } catch (error) {
        logger.error("Failed to load ticket detail", error)
        return NextResponse.json({ message: "Failed to load ticket detail" }, { status: 500 })
    }
}
