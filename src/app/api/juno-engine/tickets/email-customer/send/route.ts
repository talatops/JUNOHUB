import { NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/auth"
import { isVendorPortalRole } from "@/lib/auth-roles"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { sendGmailReply } from "@/lib/gmail/emailService"
import {
    buildL1HtmlEmail,
    parseGmailReplyThemeJson,
    wrapGmailHtmlDocument,
} from "@/lib/gmail/emailReplyTheme"

const bodySchema = z.object({
    ticketId: z.string().trim().min(1).max(600),
    to: z.string().email(),
    subject: z.string().trim().min(1).max(300),
    body: z.string().trim().min(1).max(12000),
})

async function getActiveStoreId(userId: string): Promise<string | null> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            activeStoreId: true,
            stores: { where: { isActive: true }, take: 1, select: { id: true } },
        },
    })
    return user?.activeStoreId ?? user?.stores[0]?.id ?? null
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

        const storeId = await getActiveStoreId(session.user.id)
        if (!storeId) {
            return NextResponse.json({ message: "No active store" }, { status: 400 })
        }

        const { to, subject, body } = parsed.data
        const storeTheme = await prisma.store.findUnique({
            where: { id: storeId },
            select: { businessName: true, gmailReplyTheme: true },
        })
        const storeName = storeTheme?.businessName || "Our store"
        const theme = parseGmailReplyThemeJson(storeTheme?.gmailReplyTheme)
        const htmlBody = wrapGmailHtmlDocument(buildL1HtmlEmail(body, storeName, theme), theme)
        const sent = await sendGmailReply(
            session.user.id,
            to.trim().toLowerCase(),
            subject.trim(),
            htmlBody,
            undefined,
            {
                storeId,
                isAutomated: false,
                trigger: "TICKET_CUSTOMER_REPLY",
            },
        )

        if (!sent.success) {
            return NextResponse.json(
                { message: sent.error || "Failed to send email" },
                { status: 400 },
            )
        }

        return NextResponse.json({ success: true, messageId: sent.messageId })
    } catch (error) {
        logger.error("email-customer send failed", error)
        return NextResponse.json({ message: "Failed to send email" }, { status: 500 })
    }
}
