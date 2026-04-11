import { z } from "zod"

/** Web Push subscription body (authenticated). */
export const webPushSubscribeSchema = z.object({
    endpoint: z.string().url().max(4000),
    keys: z.object({
        p256dh: z.string().min(1).max(4000),
        auth: z.string().min(1).max(500),
    }),
})

export const webPushUnsubscribeSchema = z.object({
    endpoint: z.string().url().max(4000),
})
