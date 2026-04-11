import { getGmailAccessToken } from "../gmail"
import { logger } from "../logger"
import { sendGmailReply } from "./emailService"
import { prisma } from "../prisma"
import { screenInboundEmailForAbuse } from "@/lib/ai/gmailSafety"
import { generateAutoReplyPreview } from "@/lib/gmail/autoReplyPreview"
import {
    checkGmailAutoReplyRateLimits,
    releaseGmailInboundLease,
    tryAcquireGmailInboundLease,
} from "@/lib/gmail/gmailAutoReplyGuards"

export type ProcessIncomingEmailResult = {
    success: boolean
    error?: string
    /** True when the pipeline attempted an auto-reply to a qualifying unread customer message */
    replied?: boolean
    /** True when the message was recorded as abusive/suspicious and no auto-reply was sent */
    flagged?: boolean
}

/** Normalize Gmail / RFC5322 From header to a lowercase email address. */
function parseSenderAddress(fromHeader: string): string {
    const raw = fromHeader.trim()
    const inAngles = raw.match(/<([^>]+)>/)
    if (inAngles) {
        return inAngles[1].trim().replace(/^mailto:/i, "").toLowerCase()
    }
    const lone = raw.replace(/^mailto:/i, "").trim()
    if (/^[^\s<>"']+@[^\s<>"']+$/.test(lone)) {
        return lone.toLowerCase()
    }
    const tokens = raw.split(/\s+/)
    for (let i = tokens.length - 1; i >= 0; i--) {
        const t = tokens[i].replace(/[<>",]/g, "").trim()
        if (t.includes("@") && !t.includes("..")) {
            return t.replace(/^mailto:/i, "").toLowerCase()
        }
    }
    return lone.toLowerCase()
}

/**
 * Process an incoming email and generate an AI-assisted reply (L1 orchestrator + fallbacks).
 */
export async function processIncomingEmail(
    userId: string,
    storeId: string | null,
    _historyId?: string,
    options?: { replyTrigger?: string }
): Promise<ProcessIncomingEmailResult> {
    let replied = false
    try {
        const accessToken = await getGmailAccessToken(userId)
        if (!accessToken) {
            logger.warn("Cannot process email - Gmail not connected", { userId })
            return { success: false, error: "Gmail not connected", replied: false }
        }

        if (!storeId) {
            logger.info("No active store found for user, skipping email processing", { userId })
            return { success: false, error: "No active store", replied: false }
        }

        const unreadEmails = await getUnreadEmails(accessToken, 1)

        if (unreadEmails.length === 0) {
            logger.info("No unread emails found", { userId })
            return { success: true, replied: false }
        }

        const email = unreadEmails[0]

        const senderEmail = parseSenderAddress(email.from)

        if (!senderEmail.endsWith("@gmail.com")) {
            logger.info("Skipping non-Gmail email", { userId, senderEmail })
            return { success: true, replied: false }
        }

        const fullEmail = await getEmailContent(accessToken, email.id)
        if (!fullEmail) {
            logger.error("Failed to fetch email content", { emailId: email.id })
            return { success: false, error: "Failed to fetch email content", replied: false }
        }

        const emailBody = extractEmailBody(fullEmail)
        const emailSubject = email.subject || "No Subject"

        logger.info("Processing incoming email", {
            userId,
            storeId,
            from: senderEmail,
            subject: emailSubject,
            emailId: email.id,
        })

        const plainForAi = emailBody.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()

        const safety = await screenInboundEmailForAbuse(emailSubject, plainForAi)
        if (safety?.flagged) {
            try {
                const existing = await prisma.flaggedEmail.findFirst({
                    where: { storeId, messageId: email.id },
                })
                if (!existing) {
                    await prisma.flaggedEmail.create({
                        data: {
                            storeId,
                            subject: emailSubject.slice(0, 5000),
                            from: senderEmail,
                            reason: safety.reason,
                            priority: safety.priority,
                            messageId: email.id,
                        },
                    })
                }
                logger.warn("Inbound email flagged — no auto-reply", {
                    userId,
                    storeId,
                    from: senderEmail,
                    priority: safety.priority,
                })
            } catch (flagErr) {
                logger.error("Failed to persist flagged email", flagErr)
            }

            const markedRead = await markEmailAsRead(accessToken, email.id)
            if (!markedRead) {
                logger.warn("Failed to mark flagged email as read", { userId, emailId: email.id })
            }

            return { success: true, replied: false, flagged: true }
        }

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
                    to: senderEmail,
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

        const rateCheck = await checkGmailAutoReplyRateLimits(storeId, senderEmail)
        if (!rateCheck.ok) {
            logger.warn("Gmail auto-reply rate limited", {
                userId,
                storeId,
                senderEmail,
                reason: rateCheck.reason,
            })
            await markEmailAsRead(accessToken, email.id)
            return { success: true, replied: false }
        }

        const leaseAcquired = await tryAcquireGmailInboundLease(userId, storeId, email.id)
        if (!leaseAcquired) {
            logger.info("Gmail inbound already processed — skip duplicate auto-reply", {
                userId,
                storeId,
                emailId: email.id,
            })
            await markEmailAsRead(accessToken, email.id)
            return { success: true, replied: false }
        }

        try {
            const preview = await generateAutoReplyPreview({
                storeId,
                fromEmail: senderEmail,
                subject: emailSubject,
                body: emailBody,
            })

            logger.info("Gmail classification", {
                userId,
                storeId,
                intent: preview.classification.intent,
                mood: preview.classification.mood,
                confidence: preview.classification.confidence,
                classifySource: preview.classifySource,
            })
            logger.info("Gmail order context for reply", {
                storeId,
                orderSummaryChars: preview.orderSummaryRaw.trim().length,
                orderHints: preview.orderHints,
                offTopic: preview.classification.intent === "off_topic" || preview.offTopicByHeuristic,
                offTopicByHeuristic: preview.offTopicByHeuristic,
                needsOrderNumberFirst: preview.needsOrderNumberFirst,
                hintUnmatched: preview.hintUnmatched,
                lowConfidenceSuppressOrders: preview.lowConfidenceSuppressOrders,
                messageTooSparse: preview.messageTooSparse,
                suppressOrdersOnFallbackClassification: preview.suppressOrdersOnFallbackClassification,
            })

            const finalReply = preview.html

            const replySubject = emailSubject.startsWith("Re:") ? emailSubject : `Re: ${emailSubject}`

            replied = true
            const autoTrigger =
                preview.l1Used === true
                    ? "AI_L1_REPLY"
                    : options?.replyTrigger ?? "GMAIL_WEBHOOK"
            const result = await sendGmailReply(
                userId,
                senderEmail,
                replySubject,
                finalReply,
                email.threadId,
                {
                    storeId,
                    isAutomated: true,
                    trigger: autoTrigger,
                    originalMessageId: email.messageId,
                }
            )

            if (!result.success) {
                await releaseGmailInboundLease(userId, email.id)
            }

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

            return { success: result.success, error: result.error, replied }
        } catch (processError) {
            await releaseGmailInboundLease(userId, email.id)
            throw processError
        }
    } catch (error) {
        logger.error("Error processing incoming email", error)
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
            replied,
        }
    }
}

/**
 * Get unread emails from Gmail
 */
async function getUnreadEmails(
    accessToken: string,
    maxResults: number = 10
): Promise<
    Array<{
        id: string
        threadId: string
        from: string
        subject: string
        snippet: string
        messageId: string
    }>
> {
    try {
        const searchResponse = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=is:unread newer_than:10m&maxResults=${maxResults}`,
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
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
                                Authorization: `Bearer ${accessToken}`,
                            },
                        }
                    )

                    if (!messageResponse.ok) {
                        return null
                    }

                    const messageData = await messageResponse.json()
                    const headers = messageData.payload?.headers || []
                    const fromHeader = headers.find((h: { name: string }) => h.name.toLowerCase() === "from")
                    const subjectHeader = headers.find((h: { name: string }) => h.name.toLowerCase() === "subject")
                    const messageIdHeader = headers.find(
                        (h: { name: string }) => h.name.toLowerCase() === "message-id"
                    )

                    return {
                        id: msg.id,
                        threadId: msg.threadId,
                        from: fromHeader?.value || "",
                        subject: subjectHeader?.value || "",
                        snippet: messageData.snippet || "",
                        messageId: messageIdHeader?.value || "",
                    }
                } catch (error) {
                    logger.error("Error fetching message details", { error, messageId: msg.id })
                    return null
                }
            })
        )

        return emailDetails.filter((e) => e !== null) as Array<{
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

async function getEmailContent(accessToken: string, messageId: string): Promise<unknown | null> {
    try {
        const response = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
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

function extractEmailBody(message: {
    payload?: unknown
    snippet?: string
}): string {
    try {
        const payload = message.payload as
            | {
                  mimeType?: string
                  body?: { data?: string }
                  parts?: unknown[]
              }
            | undefined
        if (!payload) {
            return ""
        }

        const decodePart = (part: { body?: { data?: string } }): string => {
            if (part.body?.data) {
                return Buffer.from(part.body.data, "base64url").toString("utf-8")
            }
            return ""
        }

        const collectParts = (part: Record<string, unknown>, mimeType: string): string[] => {
            const results: string[] = []
            if (part.mimeType === mimeType && (part.body as { data?: string } | undefined)?.data) {
                results.push(decodePart(part as { body?: { data?: string } }))
            }
            if (Array.isArray(part.parts)) {
                for (const p of part.parts) {
                    results.push(...collectParts(p as Record<string, unknown>, mimeType))
                }
            }
            return results
        }

        let body =
            collectParts(payload as Record<string, unknown>, "text/plain").join("\n").trim() ||
            collectParts(payload as Record<string, unknown>, "text/html").join("\n").trim() ||
            message.snippet ||
            ""

        const lines = body.split(/\r?\n/)
        const cleanedLines: string[] = []
        for (const line of lines) {
            const trimmed = line.trim()
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

async function markEmailAsRead(accessToken: string, messageId: string): Promise<boolean> {
    try {
        const response = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    removeLabelIds: ["UNREAD"],
                }),
            }
        )

        return response.ok
    } catch (error) {
        logger.error("Error marking email as read", error)
        return false
    }
}
