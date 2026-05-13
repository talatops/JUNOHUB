import { prisma } from "@/lib/prisma"

export type TicketMessage = {
    id: string
    subject: string
    bodyPreview: string | null
    status: string
    trigger: string | null
    sentAt: string
    metadata?: unknown
    storefrontConversationId?: string | null
}

export type TicketThread = {
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

export function normalizeSubject(subject: string | null): string {
    if (!subject) return "No subject"
    let s = subject.trim()
    while (true) {
        const match = s.match(/^(re|fw|fwd):\s*/i)
        if (!match) break
        s = s.slice(match[0].length).trim()
    }
    return s || "No subject"
}

export function decodeHtmlEntities(input: string | null | undefined): string {
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

export function parseTicketId(ticketId: string): {
    customerEmail: string
    rootSubject: string
} | null {
    const splitAt = ticketId.indexOf("::")
    if (splitAt < 0) return null
    const customerEmail = ticketId.slice(0, splitAt).trim().toLowerCase()
    const rootSubject = ticketId.slice(splitAt + 2).trim()
    if (!customerEmail || !rootSubject) return null
    return { customerEmail, rootSubject }
}

type RawEmailLog = {
    id: string
    to: string
    subject: string | null
    bodyPreview: string | null
    status: string
    trigger: string | null
    sentAt: Date
    metadata: unknown
    storefrontConversationId: string | null
}

async function getTicketLogsForStore(storeId: string): Promise<RawEmailLog[]> {
    return prisma.$queryRaw<RawEmailLog[]>`
        SELECT
            "id",
            "to",
            "subject",
            "bodyPreview",
            "status",
            "trigger",
            "sentAt",
            "metadata",
            "storefrontConversationId"
        FROM "EmailLog"
        WHERE "storeId" = ${storeId}
          AND (
            "isAutomated" = TRUE
            OR "trigger" = 'GMAIL_INCOMING'
            OR "trigger" = 'TICKET_CUSTOMER_REPLY'
          )
        ORDER BY "sentAt" DESC
        LIMIT 4000
    `
}

function buildThreads(logs: RawEmailLog[]): TicketThread[] {
    const map = new Map<string, TicketThread>()
    for (const log of logs) {
        const customerEmail = (log.to || "").toLowerCase()
        const rootSubject = normalizeSubject(log.subject)
        const key = `${customerEmail}::${rootSubject}`
        const message: TicketMessage = {
            id: log.id,
            subject: log.subject || rootSubject,
            bodyPreview: decodeHtmlEntities(log.bodyPreview),
            status: log.status,
            trigger: log.trigger,
            sentAt: log.sentAt.toISOString(),
            metadata: log.metadata,
            storefrontConversationId: log.storefrontConversationId,
        }
        const existing = map.get(key)
        if (!existing) {
            map.set(key, {
                id: key,
                subject: log.subject || rootSubject,
                rootSubject,
                customerEmail,
                status: log.status,
                updatedAt: log.sentAt.toISOString(),
                messagesCount: 1,
                lastMessageSnippet: decodeHtmlEntities(log.bodyPreview),
                messages: [message],
            })
            continue
        }
        existing.messages.push(message)
        existing.messagesCount += 1
    }
    return Array.from(map.values())
}

export async function listTicketThreadsForStore(storeId: string): Promise<TicketThread[]> {
    const logs = await getTicketLogsForStore(storeId)
    return buildThreads(logs).filter((t) => {
        const latest = t.messages[0]
        const storefrontEscalationThread = t.messages.some(
            (m) => m.trigger === "STOREFRONT_TICKET",
        )
        const resolvedByVendorEmail = latest?.trigger === "TICKET_CUSTOMER_REPLY"
        if (storefrontEscalationThread && resolvedByVendorEmail) {
            return false
        }
        return true
    })
}

export async function getTicketThreadForStore(
    storeId: string,
    ticketId: string,
): Promise<TicketThread | null> {
    const parsed = parseTicketId(ticketId)
    if (!parsed) return null
    const threads = await listTicketThreadsForStore(storeId)
    return threads.find((t) => t.id === `${parsed.customerEmail}::${parsed.rootSubject}`) || null
}
