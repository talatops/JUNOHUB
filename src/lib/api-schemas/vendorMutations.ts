import { z } from "zod"

const TEMPLATE_VARS_JSON_MAX = 50_000

function refineTemplateVariables(variables: unknown, ctx: z.RefinementCtx, path: (string | number)[]) {
    try {
        const s = JSON.stringify(variables)
        if (s.length > TEMPLATE_VARS_JSON_MAX) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path,
                message: "variables JSON too large",
            })
        }
    } catch {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path,
            message: "Invalid variables",
        })
    }
}

/** POST /api/juno-engine/templates */
export const junoTemplateCreateSchema = z
    .object({
        name: z.string().trim().min(1).max(200),
        intent: z.string().trim().min(1).max(100),
        mood: z.string().trim().min(1).max(100),
        description: z.string().trim().max(2000).nullable().optional(),
        body: z.string().max(200_000),
        variables: z.unknown().optional(),
        isHtml: z.boolean().optional(),
    })
    .superRefine((data, ctx) => {
        if (data.variables !== undefined) {
            refineTemplateVariables(data.variables, ctx, ["variables"])
        }
    })

/** PUT /api/juno-engine/templates/[templateId] — partial update */
export const junoTemplatePatchSchema = z
    .object({
        name: z.string().trim().min(1).max(200).optional(),
        intent: z.string().trim().min(1).max(100).optional(),
        mood: z.string().trim().min(1).max(100).optional(),
        description: z.string().trim().max(2000).nullable().optional(),
        body: z.string().max(200_000).optional(),
        variables: z.unknown().optional(),
        isHtml: z.boolean().optional(),
    })
    .superRefine((data, ctx) => {
        if (data.variables !== undefined) {
            refineTemplateVariables(data.variables, ctx, ["variables"])
        }
    })

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

export type JunoTemplateCreateInput = z.infer<typeof junoTemplateCreateSchema>
export type JunoTemplatePatchInput = z.infer<typeof junoTemplatePatchSchema>
export type NotificationsMarkReadInput = z.infer<typeof notificationsMarkReadSchema>
