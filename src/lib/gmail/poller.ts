import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { processIncomingEmail } from "@/lib/gmail/emailProcessor"
import { reconcileLowStockForActiveStores } from "@/lib/automation/lowStock"

let pollerStarted = false
let gmailPollCycles = 0

/**
 * Run a single polling cycle for all users who have GmailIntegration configured.
 * For each user, we look up their active store and call processIncomingEmail,
 * which will:
 * - Fetch unread emails
 * - Generate an AI or fallback reply
 * - Send the reply and mark emails as read
 * - Log into EmailLog for ticket views
 */
export async function pollAllGmailOnce() {
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const integrations = await (prisma as any).gmailIntegration.findMany({
            include: {
                user: {
                    include: {
                        stores: {
                            where: { isActive: true },
                            take: 1,
                            select: { id: true },
                        },
                    },
                },
            },
        })

        if (!integrations.length) {
            logger.info("Gmail poller: no gmailIntegration records found")
            return
        }

        logger.info("Gmail poller: starting poll cycle", {
            integrations: integrations.length,
        })

        for (const integration of integrations) {
            const userId: string = integration.userId
            const storeId: string | null = integration.user.stores[0]?.id ?? null

            try {
                const result = await processIncomingEmail(userId, storeId)

                logger.info("Gmail poller: processed user", {
                    userId,
                    storeId,
                    success: result.success,
                    error: result.error,
                })
            } catch (error) {
                logger.error("Gmail poller: error processing user", {
                    userId,
                    storeId,
                    error,
                })
            }
        }

        gmailPollCycles += 1
        if (gmailPollCycles % 10 === 0) {
            void reconcileLowStockForActiveStores().catch((e) =>
                logger.error("Gmail poller: low-stock reconcile failed", e),
            )
        }
    } catch (error) {
        logger.error("Gmail poller: failed to query integrations", error)
    }
}

/**
 * Start a simple in-process cron-style poller.
 * 
 * IMPORTANT: This should only be started once per Node.js process.
 * We guard with a flag and call it from the /api/health route so it
 * starts when the container's health check hits the app.
 */
export function startGmailPoller() {
    if (pollerStarted) {
        return
    }
    pollerStarted = true

    const intervalMs =
        Number.parseInt(process.env.GMAIL_POLL_INTERVAL_MS || "", 10) || 60_000

    logger.info("Gmail poller: starting interval", { intervalMs })

    // Fire-and-forget interval; errors are logged inside pollAllGmailOnce
    setInterval(() => {
        void pollAllGmailOnce()
    }, intervalMs)
}

