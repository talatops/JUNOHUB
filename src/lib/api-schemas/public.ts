import { z } from "zod"
import { emailSchema } from "@/lib/validation"

function optionalEmailField() {
    return z
        .union([z.string(), z.null(), z.undefined()])
        .optional()
        .transform((s) => {
            if (s === undefined || s === null) return undefined
            const t = s.trim()
            return t === "" ? undefined : t
        })
        .superRefine((val, ctx) => {
            if (val === undefined) return
            const r = emailSchema.safeParse(val)
            if (!r.success) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: r.error.issues[0]?.message ?? "Invalid email",
                })
            }
        })
}

/** Newsletter footer subscription */
export const newsletterSubscribeSchema = z.object({
    email: emailSchema,
})

const storefrontShopSchema = z
    .string()
    .trim()
    .min(1, "Missing shop")
    .max(512, "Shop identifier too long")

const storefrontVisitorIdSchema = z
    .string()
    .trim()
    .min(1, "Missing visitorId")
    .max(300, "visitorId too long")

/** Anonymous storefront widget message */
export const storefrontChatPostSchema = z.object({
    shop: storefrontShopSchema,
    visitorId: storefrontVisitorIdSchema,
    content: z
        .string()
        .max(2000, "Message too long")
        .transform((s) => s.trim())
        .refine((s) => s.length >= 1, "Empty message"),
    customerEmail: optionalEmailField(),
})

export const CHAT_MESSAGE_CONTENT_MAX = 16_000

/** Serialized JSON size cap for PRODUCT/ORDER attachments (DoS guard). */
export const CHAT_ATTACHMENT_JSON_MAX = 100_000

const chatKindSchema = z.enum(["TEXT", "PRODUCT", "ORDER"])

/** B2B JUNO chat POST body */
export const chatMessagePostSchema = z
    .object({
        receiverId: z.string().trim().min(1).max(128),
        storeId: z.string().trim().min(1).max(128),
        content: z.string().max(CHAT_MESSAGE_CONTENT_MAX).default(""),
        kind: chatKindSchema.optional(),
        attachment: z.unknown().optional(),
    })
    .superRefine((data, ctx) => {
        const kind = data.kind ?? "TEXT"
        if (kind === "TEXT") {
            return
        }
        if (data.attachment === undefined || data.attachment === null) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["attachment"],
                message: "Missing attachment for typed message",
            })
            return
        }
        if (typeof data.attachment !== "object" || Array.isArray(data.attachment)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["attachment"],
                message: "Invalid attachment",
            })
            return
        }
        try {
            const serialized = JSON.stringify(data.attachment)
            if (serialized.length > CHAT_ATTACHMENT_JSON_MAX) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["attachment"],
                    message: "attachment too large",
                })
            }
        } catch {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["attachment"],
                message: "Invalid attachment",
            })
        }
    })

export const storefrontOtpRequestSchema = z.object({
    shop: storefrontShopSchema,
    visitorId: storefrontVisitorIdSchema,
    email: emailSchema,
})

export const storefrontOtpVerifySchema = z.object({
    shop: storefrontShopSchema,
    visitorId: storefrontVisitorIdSchema,
    email: emailSchema,
    code: z
        .string()
        .trim()
        .regex(/^\d{6}$/, "Enter the 6-digit code"),
})

export type NewsletterSubscribeInput = z.infer<typeof newsletterSubscribeSchema>
export type StorefrontChatPostInput = z.infer<typeof storefrontChatPostSchema>
export type ChatMessagePostInput = z.infer<typeof chatMessagePostSchema>
export type StorefrontOtpRequestInput = z.infer<typeof storefrontOtpRequestSchema>
export type StorefrontOtpVerifyInput = z.infer<typeof storefrontOtpVerifySchema>
