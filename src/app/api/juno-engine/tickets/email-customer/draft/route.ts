import { NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/auth"
import { isVendorPortalRole } from "@/lib/auth-roles"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { draftCustomerReply } from "@/lib/automation/draftCustomerReply"
import { getTicketThreadForStore } from "@/lib/tickets/emailLogTickets"

const bodySchema = z.object({
    ticketId: z.string().trim().min(1).max(600),
})

function stripStorefrontEscalationPrefix(text: string): string {
    return text.replace(/^Storefront escalation from visitor [^:]+:\s*/i, "").trim()
}

async function getActiveStoreForUser(userId: string) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            activeStoreId: true,
            stores: {
                where: { isActive: true },
                take: 1,
                select: { id: true, businessName: true },
            },
        },
    })
    const storeId = user?.activeStoreId ?? user?.stores[0]?.id ?? null
    if (!storeId) return null
    const store = await prisma.store.findUnique({
        where: { id: storeId },
        select: { id: true, businessName: true },
    })
    return store
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

        const raw = await req.json().catch(() => ({}))
        const parsed = bodySchema.safeParse(raw)
        if (!parsed.success) {
            return NextResponse.json(
                { message: "Invalid body", issues: parsed.error.flatten() },
                { status: 400 },
            )
        }

        const store = await getActiveStoreForUser(session.user.id)
        if (!store) {
            return NextResponse.json({ message: "No active store" }, { status: 400 })
        }

        const ticket = await getTicketThreadForStore(store.id, parsed.data.ticketId)
        if (!ticket) {
            return NextResponse.json({ message: "No ticket messages found" }, { status: 404 })
        }

        const conversation = ticket.messages
            .reverse()
            .map((m, idx) => {
                const body = stripStorefrontEscalationPrefix((m.bodyPreview || "").trim())
                const role = m.trigger === "GMAIL_INCOMING" ? "Customer" : "Vendor"
                return `${idx + 1}. ${role}: ${body || "(empty)"}`
            })
            .join("\n")

        const drafted = await draftCustomerReply({
            storeName: store.businessName || "Our store",
            customerEmail: ticket.customerEmail,
            ticketSubject: ticket.rootSubject,
            conversation,
        })

        if (!drafted) {
            return NextResponse.json({ message: "Draft unavailable" }, { status: 503 })
        }

        return NextResponse.json(drafted)
    } catch (error) {
        logger.error("email-customer draft failed", error)
        return NextResponse.json({ message: "Failed to draft email" }, { status: 500 })
    }
}
