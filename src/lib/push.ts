import webpush from 'web-push'
import { prisma } from './prisma'
import { logger } from './logger'

// Initialize VAPID keys
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT) {
    webpush.setVapidDetails(
        process.env.VAPID_SUBJECT,
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
    )
} else if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT) {
    webpush.setVapidDetails(
        process.env.VAPID_SUBJECT,
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
    )
}

export interface PushPayload {
    title: string
    body: string
    url?: string
    icon?: string
    tag?: string
    data?: Record<string, unknown>
}

export async function sendPushNotification(userId: string, payload: PushPayload) {
    try {
        // Get all subscriptions for this user
        const subscriptions = await prisma.pushSubscription.findMany({
            where: { userId }
        })

        if (subscriptions.length === 0) {
            return { success: false, reason: 'No subscriptions found' }
        }

        type PushSubscriptionRow = (typeof subscriptions)[number]
        const results = await Promise.all(
            subscriptions.map(async (sub: PushSubscriptionRow) => {
                try {
                    await webpush.sendNotification(
                        {
                            endpoint: sub.endpoint,
                            keys: {
                                p256dh: sub.p256dh,
                                auth: sub.auth
                            }
                        },
                        JSON.stringify(payload)
                    )
                    return { endpoint: sub.endpoint, success: true }
                } catch (error: unknown) {
                    logger.error('Failed to send push notification to endpoint', {
                        error,
                        endpoint: sub.endpoint
                    })

                    const statusCode = error && typeof error === 'object' && 'statusCode' in error
                        ? (error as { statusCode?: number }).statusCode
                        : undefined
                    // If subscription is expired or invalid, remove it
                    if (statusCode === 410 || statusCode === 404) {
                        await prisma.pushSubscription.delete({
                            where: { endpoint: sub.endpoint }
                        })
                    }

                    return { endpoint: sub.endpoint, success: false, error }
                }
            })
        )

        return { success: true, results }
    } catch (error) {
        logger.error('Error in sendPushNotification', error)
        return { success: false, error }
    }
}
