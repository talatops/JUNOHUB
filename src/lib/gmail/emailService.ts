import { getGmailAccessToken } from "../gmail"
import { logger } from "../logger"
import { prisma } from "../prisma"

type SendGmailReplyOptions = {
    storeId?: string | null
    isAutomated?: boolean
    trigger?: string
    metadata?: unknown
    storefrontConversationId?: string | null
    /**
     * Original RFC 2822 Message-ID header of the email we are replying to.
     * Used for proper threading in recipients' inboxes via In-Reply-To/References.
     */
    originalMessageId?: string
}

/**
 * Send an email via Gmail API
 */
export async function sendGmailReply(
    userId: string,
    to: string,
    subject: string,
    body: string,
    threadId?: string,
    options: SendGmailReplyOptions = {}
): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
        const accessToken = await getGmailAccessToken(userId)
        if (!accessToken) {
            return { success: false, error: "Gmail not connected or token expired" }
        }

        // Normalize original Message-ID for proper threading (ensure angle brackets)
        let replyMessageIdHeader: string | undefined
        if (options.originalMessageId) {
            const trimmed = options.originalMessageId.trim()
            replyMessageIdHeader = trimmed.includes("<") ? trimmed : `<${trimmed}>`
        }

        // Create email message in RFC 2822 format
        // If we know the original Message-ID, include proper threading headers
        const emailLines = [
            `To: ${to}`,
            `Subject: ${subject}`,
            ...(replyMessageIdHeader
                ? [
                    `In-Reply-To: ${replyMessageIdHeader}`,
                    `References: ${replyMessageIdHeader}`,
                ]
                : []),
            "Content-Type: text/html; charset=utf-8",
            "",
            body
        ]

        const rawMessage = emailLines.join("\r\n")

        // Encode message in base64url format (RFC 4648)
        const encodedMessage = Buffer.from(rawMessage)
            .toString("base64")
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/, "")

        const requestBody: { raw: string; threadId?: string } = {
            raw: encodedMessage
        }

        if (threadId) {
            requestBody.threadId = threadId
        }

        const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(requestBody)
        })

        // Store a longer, cleaner plain-text version of the outgoing email for ticket view
        let bodyPreview = body
            .replace(/<style[\s\S]*?<\/style>/gi, "")
            .replace(/<[^>]+>/g, "")
            .replace(/\s+\n/g, "\n")
            .replace(/\n{3,}/g, "\n\n")
            .trim()

        // Normalize indentation so lines align nicely in the chat UI
        bodyPreview = bodyPreview
            .split(/\r?\n/)
            .map((line) => line.trimStart())
            .join("\n")
        const baseLogData = {
            userId,
            storeId: options.storeId || null,
            to,
            subject,
            bodyPreview,
            metadata: options.metadata,
            storefrontConversationId: options.storefrontConversationId ?? null,
            isAutomated: options.isAutomated ?? false,
            trigger: options.trigger,
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            logger.error("Failed to send Gmail reply", { error: errorData, userId, to })

            // Best-effort logging for failed sends
            try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await (prisma as any).emailLog.create({
                    data: {
                        ...baseLogData,
                        status: "FAILED",
                        providerMessageId: null,
                        errorMessage: typeof errorData === "object" ? JSON.stringify(errorData) : "Failed to send email via Gmail API",
                    },
                })
            } catch (logError) {
                logger.error("Failed to log email send failure", logError)
            }

            return { success: false, error: "Failed to send email via Gmail API" }
        }

        const result = await response.json()
        logger.info("Gmail reply sent successfully", { userId, to, messageId: result.id })

        // Log successful email send
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (prisma as any).emailLog.create({
                data: {
                    ...baseLogData,
                    status: "SENT",
                    providerMessageId: result.id,
                    errorMessage: null,
                    sentAt: new Date(),
                },
            })
        } catch (logError) {
            logger.error("Failed to log email send", logError)
        }

        return { success: true, messageId: result.id }
    } catch (error) {
        logger.error("Error sending Gmail reply", error)
        return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
    }
}

/**
 * Get recent unread emails from Gmail
 */
export async function getUnreadEmails(
    userId: string,
    maxResults: number = 10
): Promise<Array<{
    id: string
    threadId: string
    from: string
    subject: string
    snippet: string
    date: string
    messageId: string
}>> {
    try {
        const accessToken = await getGmailAccessToken(userId)
        if (!accessToken) {
            logger.warn("Cannot get unread emails - Gmail not connected", { userId })
            return []
        }

        // Search for unread emails
        const searchResponse = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=is:unread&maxResults=${maxResults}`,
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`
                }
            }
        )

        if (!searchResponse.ok) {
            logger.error("Failed to search Gmail messages", { userId })
            return []
        }

        const searchResult = await searchResponse.json()
        const messages = searchResult.messages || []

        // Fetch full message details
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
                    const dateHeader = headers.find((h: { name: string }) => h.name.toLowerCase() === "date")
                    const messageIdHeader = headers.find((h: { name: string }) => h.name.toLowerCase() === "message-id")

                    return {
                        id: msg.id,
                        threadId: msg.threadId,
                        from: fromHeader?.value || "",
                        subject: subjectHeader?.value || "",
                        snippet: messageData.snippet || "",
                        date: dateHeader?.value || "",
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
            date: string
            messageId: string
        }>
    } catch (error) {
        logger.error("Error getting unread emails", error)
        return []
    }
}

/**
 * Mark email as read
 */
export async function markEmailAsRead(userId: string, messageId: string): Promise<boolean> {
    try {
        const accessToken = await getGmailAccessToken(userId)
        if (!accessToken) {
            return false
        }

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
