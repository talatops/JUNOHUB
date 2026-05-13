import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { isVendorPortalRole } from "@/lib/auth-roles"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { listTicketThreadsForStore } from "@/lib/tickets/emailLogTickets"

export async function GET(request: Request) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        if (!isVendorPortalRole(session.user.role)) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 })
        }

        // Find the vendor's active store to scope tickets
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            include: {
                stores: {
                    where: { isActive: true },
                    take: 1,
                    select: { id: true }
                }
            }
        })

        const activeStore = user?.stores[0]
        if (!activeStore) {
            return NextResponse.json({ tickets: [] })
        }

        const { searchParams } = new URL(request.url)
        const query = (searchParams.get("q") || "").trim().toLowerCase()

        const tickets = await listTicketThreadsForStore(activeStore.id)
        const filtered = query
            ? tickets.filter((t) => {
                  const haystack = [
                      t.subject,
                      t.rootSubject,
                      t.customerEmail,
                      t.lastMessageSnippet,
                      ...t.messages.map((m) => m.bodyPreview || ""),
                  ]
                      .join("\n")
                      .toLowerCase()
                  return haystack.includes(query)
              })
            : tickets
        const light = filtered.map((t) => ({
            ...t,
            messages: [],
        }))
        return NextResponse.json({ tickets: light })
    } catch (error) {
        logger.error("Failed to load vendor tickets from email logs", error)
        return NextResponse.json(
            { message: "Failed to load tickets", tickets: [] },
            { status: 500 }
        )
    }
}

