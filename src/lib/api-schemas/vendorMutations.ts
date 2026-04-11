import { z } from "zod"

/** POST /api/notifications — mark read */
export const notificationsMarkReadSchema = z
    .object({
        markAllAsRead: z.boolean().optional(),
        notificationIds: z.array(z.string().trim().min(1).max(128)).max(200).optional(),
    })
    .superRefine((data, ctx) => {
        if (data.markAllAsRead === true) return
        if (data.notificationIds && data.notificationIds.length > 0) return
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Provide markAllAsRead: true or a non-empty notificationIds array",
        })
    })

export type NotificationsMarkReadInput = z.infer<typeof notificationsMarkReadSchema>
