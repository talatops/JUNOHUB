import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { getUnreadEmails, sendGmailReply, markEmailAsRead } from "@/lib/gmail/emailService"

/**
 * POST /api/integrations/gmail/poll
 * Manually trigger email polling and automated replies
 * This can be called periodically via cron job or manually
 */
export async function POST(req: Request) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        // Get user's active store
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            include: {
                stores: {
                    where: { isActive: true },
                    take: 1
                }
            }
        })

        const storeId = user?.stores[0]?.id

        // Process incoming emails
        const unreadEmails = await getUnreadEmails(session.user.id, 10)
        const processed: string[] = []
        const failed: string[] = []

        for (const email of unreadEmails) {
            try {
                // Extract email domain from sender
                const emailMatch = email.from.match(/<(.+)>/)
                const senderEmail = emailMatch ? emailMatch[1] : email.from.split(" ").pop() || email.from
                const senderDomain = senderEmail.split("@")[1]?.toLowerCase()

                // Only reply to gmail.com addresses
                if (senderDomain !== "gmail.com") {
                    logger.info("Skipping email - not from gmail.com", {
                        userId: session.user.id,
                        from: email.from,
                        domain: senderDomain
                    })
                    continue
                }

                // Send automated reply (dummy response for testing)
                const replySubject = email.subject.startsWith("Re:") ? email.subject : `Re: ${email.subject}`
                const replyBody = `
                    <div style="font-family: Arial, sans-serif; padding: 20px;">
                        <p>Thank you for your email. This is an automated reply.</p>
                        <p>We have received your message and will get back to you soon.</p>
                        <br/>
                        <p>Best regards,<br/>JUNOHUB Support Team</p>
                    </div>
                `

                const result = await sendGmailReply(
                    session.user.id,
                    senderEmail,
                    replySubject,
                    replyBody,
                    email.threadId,
                    {
                        storeId,
                        isAutomated: true,
                        trigger: "GMAIL_AUTO_REPLY",
                        originalMessageId: email.messageId,
                    }
                )

                if (result.success) {
                    // Mark email as read after replying
                    await markEmailAsRead(session.user.id, email.id)
                    processed.push(email.id)
                    logger.info("Automated reply sent", {
                        userId: session.user.id,
                        to: senderEmail,
                        subject: email.subject
                    })
                } else {
                    failed.push(email.id)
                    logger.error("Failed to send automated reply", {
                        userId: session.user.id,
                        to: senderEmail,
                        error: result.error
                    })
                }
            } catch (error) {
                failed.push(email.id)
                logger.error("Error processing email", { emailId: email.id, error })
            }
        }

        return NextResponse.json({
            success: true,
            processed: processed.length,
            failed: failed.length,
            total: unreadEmails.length
        })
    } catch (error) {
        logger.error("Email polling error", error)
        return NextResponse.json(
            { message: "Failed to poll emails" },
            { status: 500 }
        )
    }
}
