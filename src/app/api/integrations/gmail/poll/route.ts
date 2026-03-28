import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { processIncomingEmail } from "@/lib/gmail/emailProcessor"

const MAX_ITERATIONS = 10

/**
 * POST /api/integrations/gmail/poll
 * Manually trigger email polling and automated replies (same pipeline as Gmail webhook).
 */
export async function POST(_req: Request) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            include: {
                stores: {
                    where: { isActive: true },
                    take: 1,
                },
            },
        })

        const storeId = user?.stores[0]?.id ?? null

        let iterations = 0
        let repliesAttempted = 0
        let flaggedCount = 0
        let lastSuccess = true
        let lastError: string | undefined

        for (let i = 0; i < MAX_ITERATIONS; i++) {
            const result = await processIncomingEmail(session.user.id, storeId, undefined, {
                replyTrigger: "GMAIL_POLL",
            })
            iterations++
            lastSuccess = result.success
            lastError = result.error
            if (!result.success) {
                break
            }
            if (result.flagged) {
                flaggedCount++
            }
            if (result.replied) {
                repliesAttempted++
            }
            if (!result.replied) {
                break
            }
        }

        return NextResponse.json({
            success: lastSuccess,
            iterations,
            repliesAttempted,
            flaggedCount,
            error: lastError,
        })
    } catch (error) {
        logger.error("Email polling error", error)
        return NextResponse.json({ message: "Failed to poll emails" }, { status: 500 })
    }
}
