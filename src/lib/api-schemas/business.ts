import { z } from "zod"

const requiredPriceField = z
    .union([z.string(), z.number()])
    .transform((v) => (typeof v === "string" ? parseFloat(v.trim()) : v))
    .refine((n) => Number.isFinite(n) && n >= 0 && n <= 1e12, "Invalid price")

const optionalPriceField = z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => {
        if (v === undefined) return undefined
        return typeof v === "string" ? parseFloat(v.trim()) : v
    })
    .refine((n) => n === undefined || (Number.isFinite(n) && n >= 0 && n <= 1e12), "Invalid price")

/** POST /api/supplier/products — create catalog product */
export const supplierProductCreateSchema = z.object({
    title: z.string().trim().min(1, "Title is required").max(500),
    description: z.string().trim().max(50_000).optional().nullable(),
    price: requiredPriceField,
    sku: z.string().trim().max(200).optional().nullable(),
    imageUrl: z.string().trim().max(4000).optional().nullable(),
})

/** PUT /api/supplier/products/[productId] */
export const supplierProductUpdateSchema = z
    .object({
        title: z.string().trim().min(1).max(500).optional(),
        description: z.string().trim().max(50_000).optional().nullable(),
        price: optionalPriceField,
        sku: z.string().trim().max(200).optional().nullable(),
        imageUrl: z.string().trim().max(4000).optional().nullable(),
        quantity: z.number().int().min(0).max(1e9).optional(),
    })

const shopifyProductIdSchema = z.union([
    z.number().int().positive(),
    z.string().trim().min(1).max(64),
])

const PRODUCT_SYNC_JSON_MAX = 2_000_000

/** POST /api/products/sync */
export const productSyncRequestSchema = z
    .object({
        shopifyProductId: shopifyProductIdSchema.transform((v) => String(v)),
        shopifyProductTitle: z.string().trim().min(1).max(500),
        shopifyProductData: z.unknown().optional(),
        supplierId: z.string().trim().min(1).max(128),
    })
    .superRefine((data, ctx) => {
        if (data.shopifyProductData === undefined) return
        try {
            const s = JSON.stringify(data.shopifyProductData)
            if (s.length > PRODUCT_SYNC_JSON_MAX) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["shopifyProductData"],
                    message: "shopifyProductData too large",
                })
            }
        } catch {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["shopifyProductData"],
                message: "Invalid shopifyProductData",
            })
        }
    })

/** POST /api/supplier/profile */
export const supplierProfileUpsertSchema = z.object({
    companyName: z.string().trim().min(1, "Company name is required").max(200),
    description: z.string().trim().max(10_000).optional().nullable(),
})

/** PUT /api/products/sync/[syncId] */
export const productSyncDecisionSchema = z.object({
    action: z.enum(["accept", "reject"]),
})

/** POST /api/shopify/inventory/load-stock */
export const loadStockRequestSchema = z.object({
    productSyncId: z.string().trim().min(1).max(128),
    quantity: z.number().int().positive().max(1e9),
})

export type SupplierProductCreateInput = z.infer<typeof supplierProductCreateSchema>
export type SupplierProductUpdateInput = z.infer<typeof supplierProductUpdateSchema>
export type ProductSyncRequestInput = z.infer<typeof productSyncRequestSchema>
export type SupplierProfileUpsertInput = z.infer<typeof supplierProfileUpsertSchema>
export type ProductSyncDecisionInput = z.infer<typeof productSyncDecisionSchema>
export type LoadStockRequestInput = z.infer<typeof loadStockRequestSchema>
