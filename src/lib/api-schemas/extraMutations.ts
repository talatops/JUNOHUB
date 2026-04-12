import { z } from "zod"
import { emailSchema } from "@/lib/validation"
import { normalizeFulfillmentStatus } from "@/lib/orders/fulfillmentStatus"
import { isSupplierHoldReasonCode } from "@/lib/orders/supplierHoldReasons"

const totpCodeSchema = z
    .string()
    .trim()
    .length(6, "Verification code must be 6 digits")
    .regex(/^\d+$/, "Verification code must be numeric")

/** POST /api/auth/verify-mfa */
export const authVerifyMfaSchema = z.object({
    email: emailSchema,
    code: totpCodeSchema,
})

/** POST /api/auth/verify-email/verify */
export const authVerifyEmailBodySchema = z.object({
    token: z.string().trim().min(1).max(512),
    email: emailSchema,
})

/** POST /api/settings/mfa/toggle */
export const mfaToggleSchema = z.object({
    enabled: z.boolean(),
})

/** POST /api/settings/mfa/verify */
export const mfaSetupVerifySchema = z.object({
    code: totpCodeSchema,
})

/** POST /api/stores/switch */
export const storeSwitchSchema = z.object({
    storeId: z.string().trim().min(1).max(128),
})

const shopifyDomainField = z.string().trim().min(1).max(512)
const accessTokenField = z.string().trim().min(1).max(4000)

/** POST /api/onboarding/complete */
export const onboardingCompleteSchema = z.object({
    businessName: z.string().trim().min(1).max(200),
    businessEmail: z.union([emailSchema, z.literal("")]).optional(),
    country: z.string().trim().max(100).optional(),
    timezone: z.string().trim().max(100).optional(),
    storeName: z.string().trim().max(200).optional(),
    domain: shopifyDomainField,
    apiKey: z.string().trim().max(500).optional(),
    apiSecret: z.string().trim().max(500).optional(),
    accessToken: accessTokenField,
})

/** POST /api/onboarding/shopify */
export const onboardingShopifySchema = z.object({
    businessName: z.string().trim().min(1).max(200),
    storeName: z.string().trim().min(1).max(200),
    domain: shopifyDomainField,
    apiKey: z.string().trim().min(1).max(500),
    apiSecret: z.string().trim().min(1).max(500),
    accessToken: accessTokenField,
})

/** POST /api/stores/[storeId]/kb/query */
export const kbQuerySchema = z
    .object({
        query: z.string().max(16_000),
        topK: z.number().int().min(1).max(20).optional(),
        includeFaq: z.boolean().optional(),
        includeDocuments: z.boolean().optional(),
        includeStructured: z.boolean().optional(),
    })
    .transform((d) => ({
        ...d,
        query: d.query.trim(),
    }))
    .refine((d) => d.query.length >= 1, { message: "Query is required", path: ["query"] })

/** POST /api/stores/[storeId]/kb/faqs */
export const kbFaqCreateSchema = z.object({
    question: z.string().trim().min(1).max(4000),
    answer: z.string().trim().min(1).max(50_000),
    tags: z.unknown().optional(),
})

const FAQ_IMPORT_MAX_ITEMS = 500

/** JSON array for POST /api/stores/[storeId]/kb/faqs/import */
export const kbFaqImportArraySchema = z
    .array(
        z.object({
            question: z.string().trim().min(1).max(4000),
            answer: z.string().trim().min(1).max(50_000),
            tags: z.unknown().optional(),
        }),
    )
    .min(1, "At least one FAQ is required")
    .max(FAQ_IMPORT_MAX_ITEMS, `At most ${FAQ_IMPORT_MAX_ITEMS} FAQs per import`)

/** PUT /api/supplier/vendors/[connectionId] */
export const supplierConnectionStatusSchema = z.object({
    status: z.enum(["CONNECTED", "REJECTED"]),
})

const finitePrice = z.number().finite().min(0).max(1e12)
const positiveQty = z.number().int().min(1).max(1e9)

/** PUT /api/supplier/vendors/offers/[offerId] */
export const supplierOfferUpdateSchema = z
    .object({
        price: finitePrice.optional(),
        quantity: positiveQty.optional(),
    })
    .refine((d) => d.price !== undefined || d.quantity !== undefined, {
        message: "At least one of price or quantity must be provided",
    })

/** POST /api/supplier/vendors/[connectionId]/offers */
export const supplierOfferCreateSchema = z.object({
    productId: z.string().trim().min(1).max(128),
    price: finitePrice,
    quantity: positiveQty,
})

/** POST /api/vendors/suppliers/[supplierId]/invite */
export const vendorInvitePostSchema = z
    .object({
        connectToAllStores: z.boolean().optional(),
    })
    .strict()

/** DELETE /api/vendors/suppliers/[supplierId]/invite */
export const vendorInviteDeleteSchema = z
    .object({
        storeId: z.string().trim().min(1).max(128).optional().nullable(),
    })
    .strict()

/** POST /api/supplier/invitations/accept */
export const supplierInvitationAcceptSchema = z.object({
    token: z.string().trim().min(1).max(128),
})

/** POST /api/juno-engine/flagged-emails */
export const flaggedEmailCreateSchema = z.object({
    subject: z.string().trim().min(1).max(500),
    from: z.string().trim().min(1).max(500),
    reason: z.string().trim().min(1).max(8000),
    priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
    messageId: z.string().trim().max(500).optional(),
})

/** POST /api/shopify/validate */
export const shopifyValidateSchema = z.object({
    domain: shopifyDomainField,
    accessToken: accessTokenField,
})

/** PATCH /api/stores/[storeId]/shopify-access-token — vendor updates token after app reinstall / scope change */
export const storeShopifyAccessTokenUpdateSchema = z.object({
    accessToken: accessTokenField,
})

function optionalTrackingField(maxLen: number) {
    return z
        .union([z.string(), z.number(), z.null(), z.undefined()])
        .transform((v) => {
            if (v === undefined || v === null) return null
            const t = String(v).trim()
            return t === "" ? null : t
        })
        .refine((v) => v === null || v.length <= maxLen, "Tracking value too long")
}

function optionalHoldNoteField() {
    return z
        .union([z.string(), z.null(), z.undefined()])
        .transform((v) => {
            if (v === undefined || v === null) return null
            const t = String(v).trim()
            return t === "" ? null : t.slice(0, 2000)
        })
}

function optionalHoldReasonCodeField() {
    return z
        .union([z.string(), z.null(), z.undefined()])
        .transform((v) => {
            if (v === undefined || v === null) return null
            const t = String(v).trim()
            return t === "" ? null : t
        })
}

/** PATCH /api/supplier/orders/[orderId] */
export const supplierOrderPatchSchema = z
    .object({
        fulfillmentStatus: z.union([z.string(), z.number(), z.null(), z.undefined()]).optional(),
        trackingNumber: optionalTrackingField(500),
        trackingCompany: optionalTrackingField(500),
        trackingUrl: optionalTrackingField(2000),
        holdReasonCode: optionalHoldReasonCodeField(),
        holdNote: optionalHoldNoteField(),
    })
    .superRefine((data, ctx) => {
        const fsRaw = data.fulfillmentStatus
        if (fsRaw === undefined || fsRaw === null) return

        const canonical = normalizeFulfillmentStatus(String(fsRaw))
        if (canonical !== "ON_HOLD") return

        if (!data.holdReasonCode || !isSupplierHoldReasonCode(data.holdReasonCode)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "holdReasonCode is required for On hold status",
                path: ["holdReasonCode"],
            })
            return
        }
        if (data.holdReasonCode === "other" && !data.holdNote?.trim()) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Note is required when reason is Other",
                path: ["holdNote"],
            })
        }
    })
