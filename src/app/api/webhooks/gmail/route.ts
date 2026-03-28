import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { processIncomingEmail } from "@/lib/gmail/emailProcessor"

/**
 * POST /api/webhooks/gmail
 * Gmail Push Notification Webhook
 * 
 * This endpoint receives push notifications from Gmail when new emails arrive.
 * It processes the email and generates an AI-powered reply using the knowledge base.
 * 
 * Setup:
 * 1. Register this webhook URL in Google Cloud Console
 * 2. Set up Gmail watch for each user's mailbox
 * 3. When emails arrive, Gmail sends a notification here
 */
export async function POST(req: NextRequest) {
    try {
        // Gmail sends a verification token on initial setup
        const verificationToken = req.headers.get("x-goog-challenge")
        if (verificationToken) {
            logger.info("Gmail webhook verification request received")
            // Return the verification token to confirm webhook ownership
            return new NextResponse(verificationToken, { status: 200 })
        }

        // Parse the notification payload
        const body = await req.json().catch(() => ({}))
        const messageData = body.message?.data

        if (!messageData) {
            logger.warn("Gmail webhook received without message data")
            return NextResponse.json({ message: "No message data" }, { status: 200 })
        }

        // Decode base64url encoded message data
        const decodedData = Buffer.from(messageData, "base64")
            .toString("utf-8")

        const notification = JSON.parse(decodedData)
        const emailAddress = notification.emailAddress
        const historyId = notification.historyId

        logger.info("Gmail webhook notification received", {
            emailAddress,
            historyId,
            notification
        })

        // Find the user by Gmail email address
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const integration = await (prisma as any).gmailIntegration.findFirst({
            where: {
                email: emailAddress
            },
            include: {
                user: {
                    include: {
                        stores: {
                            where: { isActive: true },
                            take: 1
                        }
                    }
                }
            }
        })

        if (!integration) {
            logger.warn("Gmail integration not found for email", { emailAddress })
            return NextResponse.json(
                { message: "Integration not found" },
                { status: 200 } // Return 200 to prevent retries
            )
        }

        // 🛡️ SECURITY: Only allow VENDORS to use automated replies
        // Suppliers should not send automated responses via JUNO
        if (integration.user.role !== "VENDOR") {
            logger.info("Skipping Gmail processing for non-vendor role", {
                emailAddress,
                role: integration.user.role
            })
            return NextResponse.json({
                success: true,
                message: "Skipping processing for non-vendor account"
            })
        }

        const userId = integration.userId
        const storeId = integration.user.stores[0]?.id || null

        // Process the incoming email
        // This will fetch the email, analyze it, and send an AI-powered or fallback reply
        const result = await processIncomingEmail(userId, storeId, historyId)

        logger.info("Gmail webhook processing result", {
            userId,
            storeId,
            historyId,
            success: result.success,
            error: result.error,
            flagged: result.flagged,
            replied: result.replied,
        })

        return NextResponse.json({
            success: result.success,
            error: result.error,
            flagged: result.flagged ?? false,
            replied: result.replied ?? false,
            message: result.flagged
                ? "Email flagged — no auto-reply sent"
                : result.success
                  ? "Email processed successfully"
                  : "Email processing completed with errors (see logs)",
        })
    } catch (error) {
        logger.error("Gmail webhook error", error)
        // Return 200 to prevent Gmail from retrying
        // Log errors internally for debugging
        return NextResponse.json(
            { message: "Webhook processed with errors" },
            { status: 200 }
        )
    }
}

/**
 * GET /api/webhooks/gmail
 * Health check endpoint
 */
export async function GET() {
    return NextResponse.json({
        status: "ok",
        message: "Gmail webhook endpoint is active"
    })
}
