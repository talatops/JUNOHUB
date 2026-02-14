import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { getGmailAccessToken } from "@/lib/gmail"

/**
 * POST /api/integrations/gmail/watch
 * Set up Gmail push notifications (watch) for a user's mailbox
 * 
 * This creates a watch request that tells Gmail to send push notifications
 * to the webhook endpoint when new emails arrive.
 * 
 * Note: Gmail watch requests expire after 7 days and need to be renewed.
 */
export async function POST(_req: Request) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        // Get Gmail access token
        const accessToken = await getGmailAccessToken(session.user.id)
        if (!accessToken) {
            return NextResponse.json(
                { message: "Gmail not connected. Please connect your Gmail account first." },
                { status: 400 }
            )
        }

        // Get webhook URL
        const baseUrl =
            process.env.AUTH_URL ||
            process.env.NEXTAUTH_URL ||
            process.env.NEXT_PUBLIC_APP_URL ||
            "http://localhost:3000"
        const webhookUrl = `${baseUrl}/api/webhooks/gmail`

        // Get user's email from integration
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const integration = await (prisma as any).gmailIntegration.findUnique({
            where: { userId: session.user.id },
            select: { email: true }
        })

        if (!integration?.email) {
            return NextResponse.json(
                { message: "Gmail email not found" },
                { status: 400 }
            )
        }

        // Create watch request
        // Gmail will send push notifications to the webhook URL
        const watchResponse = await fetch(
            "https://gmail.googleapis.com/gmail/v1/users/me/watch",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    topicName: process.env.GMAIL_PUBSUB_TOPIC || "projects/your-project/topics/gmail-notifications",
                    labelIds: ["INBOX"], // Watch for emails in inbox
                })
            }
        )

        if (!watchResponse.ok) {
            const errorData = await watchResponse.json().catch(() => ({}))
            logger.error("Failed to set up Gmail watch", { error: errorData })
            
            // If topic doesn't exist, provide helpful error message
            if (watchResponse.status === 400) {
                return NextResponse.json(
                    { 
                        message: "Gmail Pub/Sub topic not configured. Please set up Google Cloud Pub/Sub first.",
                        error: errorData
                    },
                    { status: 400 }
                )
            }

            return NextResponse.json(
                { message: "Failed to set up Gmail watch", error: errorData },
                { status: watchResponse.status }
            )
        }

        const watchData = await watchResponse.json()
        const expiration = watchData.expiration ? new Date(parseInt(watchData.expiration)).toISOString() : null

        logger.info("Gmail watch set up successfully", {
            userId: session.user.id,
            email: integration.email,
            expiration
        })

        return NextResponse.json({
            success: true,
            message: "Gmail push notifications enabled",
            expiration,
            webhookUrl
        })
    } catch (error) {
        logger.error("Error setting up Gmail watch", error)
        return NextResponse.json(
            { message: "Failed to set up Gmail watch" },
            { status: 500 }
        )
    }
}

/**
 * GET /api/integrations/gmail/watch
 * Check watch status
 */
export async function GET() {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        const accessToken = await getGmailAccessToken(session.user.id)
        if (!accessToken) {
            return NextResponse.json(
                { message: "Gmail not connected" },
                { status: 400 }
            )
        }

        // Stop any existing watch (optional - just to check status)
        const stopResponse = await fetch(
            "https://gmail.googleapis.com/gmail/v1/users/me/stop",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json"
                }
            }
        )

        return NextResponse.json({
            watchActive: !stopResponse.ok, // If stop fails, watch might be active
            message: stopResponse.ok ? "Watch stopped" : "Watch may be active"
        })
    } catch (error) {
        logger.error("Error checking Gmail watch status", error)
        return NextResponse.json(
            { message: "Failed to check watch status" },
            { status: 500 }
        )
    }
}
