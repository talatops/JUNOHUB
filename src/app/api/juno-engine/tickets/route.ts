import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { isVendorPortalRole } from "@/lib/auth-roles"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"

// Normalize subject by stripping common reply prefixes so we can group conversations
function normalizeSubject(subject: string | null): string {
    if (!subject) return "No subject"
    let s = subject.trim()
    // Remove repeated "Re:" / "Fwd:" prefixes
    // e.g. "Re: Re: Hello" -> "Hello"
    // Case-insensitive, allow localized variants in future by trimming until no prefix matches
     
    while (true) {
        const match = s.match(/^(re|fw|fwd):\s*/i)
        if (!match) break
        s = s.slice(match[0].length).trim()
    }
    return s || "No subject"
}

function decodeHtmlEntities(input: string | null | undefined): string {
    const text = (input || "").trim()
    if (!text) return ""
    return text
        .replace(/&#(\d+);/g, (_, n: string) => {
            const code = Number.parseInt(n, 10)
            return Number.isFinite(code) ? String.fromCharCode(code) : _
        })
        .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => {
            const code = Number.parseInt(hex, 16)
            return Number.isFinite(code) ? String.fromCharCode(code) : _
        })
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
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

        // Use a raw query instead of relying on the generated Prisma model,
        // to avoid issues if the EmailLog model is not present on the client.
        const logs = await prisma.$queryRaw<
            Array<{
                id: string
                "userId": string
                "storeId": string | null
                to: string
                subject: string | null
                "bodyPreview": string | null
                "isAutomated": boolean
                trigger: string | null
                status: string
                "providerMessageId": string | null
                "errorMessage": string | null
                "sentAt": Date
            }>
        >`
            SELECT
                "id",
                "userId",
                "storeId",
                "to",
                "subject",
                "bodyPreview",
                "isAutomated",
                "trigger",
                "status",
                "providerMessageId",
                "errorMessage",
                "sentAt"
            FROM "EmailLog"
            WHERE "storeId" = ${activeStore.id}
              AND (
                "isAutomated" = TRUE
                OR "trigger" = 'GMAIL_INCOMING'
                OR "trigger" = 'TICKET_CUSTOMER_REPLY'
              )
            ORDER BY "sentAt" DESC
            LIMIT 200
        `

        type TicketMessage = {
            id: string
            subject: string
            bodyPreview: string | null
            status: string
            trigger: string | null
            sentAt: string
        }

        type Ticket = {
            id: string
            subject: string
            rootSubject: string
            customerEmail: string
            status: string
            updatedAt: string
            messagesCount: number
            lastMessageSnippet: string
            messages: TicketMessage[]
        }

        const ticketsMap = new Map<string, Ticket>()

        for (const log of logs) {
            const customerEmail = (log.to || "").toLowerCase()
            const rootSubject = normalizeSubject(log.subject)
            const key = `${customerEmail}::${rootSubject}`

            const baseMessage: TicketMessage = {
                id: log.id,
                subject: log.subject || rootSubject,
                bodyPreview: decodeHtmlEntities(log.bodyPreview),
                status: log.status,
                trigger: log.trigger,
                sentAt: log.sentAt.toISOString(),
            }

            const existing = ticketsMap.get(key)
            if (!existing) {
                ticketsMap.set(key, {
                    id: key,
                    subject: log.subject || rootSubject,
                    rootSubject,
                    customerEmail,
                    status: log.status,
                    updatedAt: log.sentAt.toISOString(),
                    messagesCount: 1,
                    lastMessageSnippet: decodeHtmlEntities(log.bodyPreview),
                    messages: [baseMessage],
                })
            } else {
                existing.messages.push(baseMessage)
                existing.messagesCount += 1
                // The logs are ordered newest-first, so the first seen message is the latest
                // Keep lastMessageSnippet / updatedAt from the first entry
            }
        }

        const tickets = Array.from(ticketsMap.values()).filter((t) => {
            const latest = t.messages[0]
            const storefrontEscalationThread = t.messages.some((m) => m.trigger === "STOREFRONT_TICKET")
            const resolvedByVendorEmail = latest?.trigger === "TICKET_CUSTOMER_REPLY"
            // Hide resolved storefront escalation threads after vendor sends customer email.
            // If customer replies later (GMAIL_INCOMING), latest trigger changes and thread reappears.
            if (storefrontEscalationThread && resolvedByVendorEmail) {
                return false
            }
            return true
        })

        return NextResponse.json({ tickets })
    } catch (error) {
        logger.error("Failed to load vendor tickets from email logs", error)
        return NextResponse.json(
            { message: "Failed to load tickets", tickets: [] },
            { status: 500 }
        )
    }
}

