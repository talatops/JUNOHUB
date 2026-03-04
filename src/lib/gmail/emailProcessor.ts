import { getGmailAccessToken } from "../gmail"
import { logger } from "../logger"
import { sendGmailReply } from "./emailService"
import { prisma } from "../prisma"
import { renderTemplate } from "@/lib/templates/simpleRenderer"

/**
 * Process an incoming email and generate an AI-powered reply
 */
export async function processIncomingEmail(
    userId: string,
    storeId: string | null,
    historyId?: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const accessToken = await getGmailAccessToken(userId)
        if (!accessToken) {
            logger.warn("Cannot process email - Gmail not connected", { userId })
            return { success: false, error: "Gmail not connected" }
        }

        // If no store is associated, skip processing
        if (!storeId) {
            logger.info("No active store found for user, skipping email processing", { userId })
            return { success: false, error: "No active store" }
        }

        // Get the most recent unread email
        const unreadEmails = await getUnreadEmails(accessToken, 1)
        
        if (unreadEmails.length === 0) {
            logger.info("No unread emails found", { userId })
            return { success: true }
        }

        const email = unreadEmails[0]

        // Extract sender email
        const emailMatch = email.from.match(/<(.+)>/)
        const senderEmail = emailMatch ? emailMatch[1] : email.from.split(" ").pop() || email.from

        // Only process emails from Gmail addresses (ending with @gmail.com)
        if (!senderEmail.toLowerCase().endsWith("@gmail.com")) {
            logger.info("Skipping non-Gmail email", { userId, senderEmail })
            return { success: true }
        }

        // Get full email content
        const fullEmail = await getEmailContent(accessToken, email.id)
        if (!fullEmail) {
            logger.error("Failed to fetch email content", { emailId: email.id })
            return { success: false, error: "Failed to fetch email content" }
        }

        // Extract email body (plain text or HTML), cleaned of quoted history
        const emailBody = extractEmailBody(fullEmail)
        const emailSubject = email.subject || "No Subject"

        logger.info("Processing incoming email", {
            userId,
            storeId,
            from: senderEmail,
            subject: emailSubject,
            emailId: email.id
        })

        // Log the incoming customer email into EmailLog so tickets show both sides
        try {
            const incomingPreview = emailBody
                .replace(/<[^>]+>/g, "")
                .replace(/\s+\n/g, "\n")
                .replace(/\n{3,}/g, "\n\n")
                .trim()
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (prisma as any).emailLog.create({
                data: {
                    userId,
                    storeId,
                    to: senderEmail, // "to" is the customer email we converse with
                    subject: emailSubject,
                    bodyPreview: incomingPreview,
                    isAutomated: false,
                    trigger: "GMAIL_INCOMING",
                    status: "RECEIVED",
                    providerMessageId: email.messageId,
                    errorMessage: null,
                    sentAt: new Date(),
                },
            })
        } catch (logError) {
            logger.error("Failed to log incoming email to EmailLog", logError)
        }

        // Try to load a store-scoped template for this intent/mood combination
        let finalReply: string | null = null
        try {
            const templateRows = await prisma.$queryRaw<
                {
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
                }[]
            >`
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
                WHERE "storeId" = ${storeId}
                  AND "intent" = 'general'
                  AND "mood" = 'neutral'
                ORDER BY "updatedAt" DESC
                LIMIT 1
            `

            const template = templateRows[0]

            if (template) {
                const store = await prisma.store.findUnique({
                    where: { id: storeId },
                    select: {
                        businessName: true,
                        email: true,
                    },
                })

                const context = {
                    customer_name: senderEmail.split("@")[0],
                    customer_email: senderEmail,
                    subject: emailSubject,
                    store_name: store?.businessName || "Your store",
                    store_email: store?.email || "",
                    ticket_summary: emailBody.slice(0, 500),
                }

                finalReply = template.isHtml
                    ? renderTemplate(template.body, context)
                    : `
                        <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 24px; line-height: 1.6; color: #0f172a;">
                            <pre style="white-space: pre-wrap; margin: 0;">${renderTemplate(
                                template.body,
                                context,
                            )}</pre>
                        </div>
                    `
            }
        } catch (templateError) {
            logger.error("Failed to render template for auto-reply", templateError)
        }

        // Fallback: simple hardcoded automated reply if no template is available
        if (!finalReply) {
            const safeSnippet = emailBody.replace(/<[^>]+>/g, "").slice(0, 400)
            finalReply = `
            <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 24px; line-height: 1.6; color: #0f172a; background-color: #0b1220;">
                <div style="max-width: 640px; margin: 0 auto; background: #020617; border-radius: 16px; border: 1px solid #1f2937; padding: 24px;">
                    <h1 style="margin: 0 0 12px; font-size: 20px; color: #e5e7eb;">Thanks for reaching out 👋</h1>
                    <p style="margin: 0 0 12px; color: #9ca3af;">
                        We’ve received your message and our team will review it shortly.
                    </p>
                    <p style="margin: 0 0 16px; color: #9ca3af;">
                        Here’s a quick summary of what you sent:
                    </p>
                    <blockquote style="margin: 0 0 20px; padding: 12px 16px; border-left: 3px solid #6366f1; background: #020617;">
                        <p style="margin: 0; white-space: pre-wrap; color: #d1d5db; font-size: 14px;">
${safeSnippet || "No additional message content was detected."}
                        </p>
                    </blockquote>
                    <p style="margin: 0 0 8px; color: #9ca3af;">
                        You don’t need to reply to this email unless you have more details to share.
                    </p>
                    <p style="margin: 0; color: #e5e7eb;">
                        Best regards,<br/>
                        <span style="color: #a5b4fc;">JUNO Support Team</span>
                    </p>
                </div>
            </div>
        `
        }

        // Send the reply
        const replySubject = emailSubject.startsWith("Re:")
            ? emailSubject 
            : `Re: ${emailSubject}`

        const result = await sendGmailReply(
            userId,
            senderEmail,
            replySubject,
            finalReply,
            email.threadId,
            {
                storeId,
                isAutomated: true,
                trigger: "GMAIL_WEBHOOK",
                originalMessageId: email.messageId,
            }
        )

        // Always attempt to mark the email as read so it isn't processed again
        const markedRead = await markEmailAsRead(accessToken, email.id)
        if (!markedRead) {
            logger.warn("Failed to mark email as read after processing", {
                userId,
                storeId,
                emailId: email.id,
            })
        }

        if (result.success) {
            logger.info("Automated reply sent successfully", {
                userId,
                storeId,
                to: senderEmail,
                subject: emailSubject,
            })
        } else {
            logger.error("Failed to send automated reply", {
                userId,
                storeId,
                to: senderEmail,
                subject: emailSubject,
                error: result.error,
            })
        }

        return { success: result.success, error: result.error }
    } catch (error) {
        logger.error("Error processing incoming email", error)
        return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
    }
}

/**
 * Get unread emails from Gmail
 */
async function getUnreadEmails(
    accessToken: string,
    maxResults: number = 10
): Promise<Array<{
    id: string
    threadId: string
    from: string
    subject: string
    snippet: string
    messageId: string
}>> {
    try {
        const searchResponse = await fetch(
            // Only consider unread emails from the last 10 minutes
            `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=is:unread newer_than:10m&maxResults=${maxResults}`,
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`
                }
            }
        )

        if (!searchResponse.ok) {
            logger.error("Failed to search Gmail messages")
            return []
        }

        const searchResult = await searchResponse.json()
        const messages = searchResult.messages || []

        const emailDetails = await Promise.all(
            messages.map(async (msg: { id: string; threadId: string }) => {
                try {
                    const messageResponse = await fetch(
                        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date&metadataHeaders=Message-ID`,
                        {
                            headers: {
                                Authorization: `Bearer ${accessToken}`
                            }
                        }
                    )

                    if (!messageResponse.ok) {
                        return null
                    }

                    const messageData = await messageResponse.json()
                    const headers = messageData.payload?.headers || []
                    const fromHeader = headers.find((h: { name: string }) => h.name.toLowerCase() === "from")
                    const subjectHeader = headers.find((h: { name: string }) => h.name.toLowerCase() === "subject")
                    const messageIdHeader = headers.find((h: { name: string }) => h.name.toLowerCase() === "message-id")

                    return {
                        id: msg.id,
                        threadId: msg.threadId,
                        from: fromHeader?.value || "",
                        subject: subjectHeader?.value || "",
                        snippet: messageData.snippet || "",
                        messageId: messageIdHeader?.value || ""
                    }
                } catch (error) {
                    logger.error("Error fetching message details", { error, messageId: msg.id })
                    return null
                }
            })
        )

        return emailDetails.filter((email) => email !== null) as Array<{
            id: string
            threadId: string
            from: string
            subject: string
            snippet: string
            messageId: string
        }>
    } catch (error) {
        logger.error("Error getting unread emails", error)
        return []
    }
}

/**
 * Get full email content
 */
async function getEmailContent(accessToken: string, messageId: string): Promise<any | null> {
    try {
        const response = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`
                }
            }
        )

        if (!response.ok) {
            return null
        }

        return await response.json()
    } catch (error) {
        logger.error("Error fetching email content", { error, messageId })
        return null
    }
}

/**
 * Extract email body from Gmail message
 */
function extractEmailBody(message: any): string {
    try {
        const payload = message.payload
        if (!payload) {
            return ""
        }

        // Prefer text/plain, fall back to text/html, then snippet
        const decodePart = (part: any): string => {
            if (part.body?.data) {
                return Buffer.from(part.body.data, "base64url").toString("utf-8")
            }
            return ""
        }

        const collectParts = (part: any, mimeType: string): string[] => {
            const results: string[] = []
            if (part.mimeType === mimeType && part.body?.data) {
                results.push(decodePart(part))
            }
            if (Array.isArray(part.parts)) {
                for (const p of part.parts) {
                    results.push(...collectParts(p, mimeType))
                }
            }
            return results
        }

        let body =
            collectParts(payload, "text/plain").join("\n").trim() ||
            collectParts(payload, "text/html").join("\n").trim() ||
            message.snippet ||
            ""

        // Strip common Gmail quotation patterns so tickets only show the latest reply
        const lines = body.split(/\r?\n/)
        const cleanedLines: string[] = []
        for (const line of lines) {
            const trimmed = line.trim()
            // Skip quoted lines and stop when we hit the typical "On ... wrote:" header
            if (trimmed.startsWith(">")) continue
            if (/^on .+wrote:$/i.test(trimmed)) break
            cleanedLines.push(line)
        }

        body = cleanedLines.join("\n").trim()

        return body
    } catch (error) {
        logger.error("Error extracting email body", error)
        return ""
    }
}

/**
 * Mark email as read
 */
async function markEmailAsRead(accessToken: string, messageId: string): Promise<boolean> {
    try {
        const response = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    removeLabelIds: ["UNREAD"]
                })
            }
        )

        return response.ok
    } catch (error) {
        logger.error("Error marking email as read", error)
        return false
    }
}

/**
 * Get user's email address from Gmail integration
 */
async function getUserEmail(userId: string): Promise<string | null> {
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const integration = await (prisma as any).gmailIntegration.findUnique({
            where: { userId },
            select: { email: true }
        })
        return integration?.email || null
    } catch (error) {
        logger.error("Error getting user email", error)
        return null
    }
}
