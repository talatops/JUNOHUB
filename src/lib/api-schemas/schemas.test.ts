import { describe, it, expect } from "vitest"
import {
    newsletterSubscribeSchema,
    storefrontChatPostSchema,
    storefrontChatActionSchema,
    storefrontChatEventSchema,
    chatMessagePostSchema,
    CHAT_MESSAGE_CONTENT_MAX,
    CHAT_ATTACHMENT_JSON_MAX,
} from "./public"
import {
    supplierProductCreateSchema,
    supplierProductUpdateSchema,
    productSyncRequestSchema,
    supplierProfileUpsertSchema,
    productSyncDecisionSchema,
    loadStockRequestSchema,
} from "./business"
import { notificationsMarkReadSchema } from "./vendorMutations"
import { webPushSubscribeSchema, webPushUnsubscribeSchema } from "./notificationsPush"
import {
    authVerifyMfaSchema,
    kbFaqImportArraySchema,
    supplierOfferUpdateSchema,
    supplierOrderPatchSchema,
    vendorInvitePostSchema,
} from "./extraMutations"

describe("newsletterSubscribeSchema", () => {
    it("accepts valid email", () => {
        const r = newsletterSubscribeSchema.safeParse({ email: "  a@b.co  " })
        expect(r.success).toBe(true)
        if (r.success) expect(r.data.email).toContain("@")
    })
    it("rejects invalid email", () => {
        expect(newsletterSubscribeSchema.safeParse({ email: "nope" }).success).toBe(false)
    })
})

describe("storefrontChatPostSchema", () => {
    it("rejects empty content after trim", () => {
        expect(
            storefrontChatPostSchema.safeParse({
                shop: "x.myshopify.com",
                visitorId: "v1",
                content: "   ",
            }).success,
        ).toBe(false)
    })

    it("accepts action-only add-to-cart payloads", () => {
        const result = storefrontChatPostSchema.safeParse({
            shop: "x.myshopify.com",
            visitorId: "v1",
            action: {
                type: "add_to_cart",
                productId: "123",
                variantId: "456",
                quantity: 1,
            },
        })
        expect(result.success).toBe(true)
        if (result.success) expect(result.data.content).toBe("")
    })
})

describe("storefrontChatActionSchema", () => {
    it("bounds action quantity", () => {
        expect(
            storefrontChatActionSchema.safeParse({
                type: "add_to_cart",
                productId: "123",
                quantity: 11,
            }).success,
        ).toBe(false)
    })
})

describe("storefrontChatEventSchema", () => {
    it("accepts cart-link-opened events", () => {
        const result = storefrontChatEventSchema.safeParse({
            shop: "x.myshopify.com",
            visitorId: "v1",
            type: "cart_link_opened",
            productId: "p1",
            variantId: "v1",
        })
        expect(result.success).toBe(true)
    })

    it("rejects unknown storefront analytics events", () => {
        expect(
            storefrontChatEventSchema.safeParse({
                shop: "x.myshopify.com",
                visitorId: "v1",
                type: "checkout_started",
            }).success,
        ).toBe(false)
    })
})

describe("chatMessagePostSchema", () => {
    it("rejects oversize content", () => {
        expect(
            chatMessagePostSchema.safeParse({
                receiverId: "u",
                storeId: "s",
                content: "x".repeat(CHAT_MESSAGE_CONTENT_MAX + 1),
            }).success,
        ).toBe(false)
    })
    it("requires attachment for PRODUCT", () => {
        expect(
            chatMessagePostSchema.safeParse({
                receiverId: "u",
                storeId: "s",
                kind: "PRODUCT",
            }).success,
        ).toBe(false)
    })
    it("rejects huge attachment JSON", () => {
        const big = { x: "y".repeat(CHAT_ATTACHMENT_JSON_MAX) }
        expect(
            chatMessagePostSchema.safeParse({
                receiverId: "u",
                storeId: "s",
                kind: "PRODUCT",
                attachment: big,
            }).success,
        ).toBe(false)
    })
})

describe("supplierProductCreateSchema", () => {
    it("parses string price", () => {
        const r = supplierProductCreateSchema.safeParse({
            title: "T",
            price: "12.50",
        })
        expect(r.success).toBe(true)
        if (r.success) expect(r.data.price).toBe(12.5)
    })
})

describe("supplierProductUpdateSchema", () => {
    it("allows empty patch object", () => {
        expect(supplierProductUpdateSchema.safeParse({}).success).toBe(true)
    })
})

describe("productSyncRequestSchema", () => {
    it("coerces numeric shopify id to string", () => {
        const r = productSyncRequestSchema.safeParse({
            shopifyProductId: 12345,
            shopifyProductTitle: "Hi",
            supplierId: "sup",
        })
        expect(r.success).toBe(true)
        if (r.success) expect(r.data.shopifyProductId).toBe("12345")
    })
})

describe("supplierProfileUpsertSchema", () => {
    it("requires company name", () => {
        expect(supplierProfileUpsertSchema.safeParse({ companyName: "" }).success).toBe(false)
    })
})

describe("productSyncDecisionSchema", () => {
    it("only allows accept/reject", () => {
        expect(productSyncDecisionSchema.safeParse({ action: "accept" }).success).toBe(true)
        expect(productSyncDecisionSchema.safeParse({ action: "hold" }).success).toBe(false)
    })
})

describe("loadStockRequestSchema", () => {
    it("accepts valid payload", () => {
        const r = loadStockRequestSchema.safeParse({ productSyncId: "clxyz123", quantity: 5 })
        expect(r.success).toBe(true)
    })
    it("rejects non-positive quantity", () => {
        expect(loadStockRequestSchema.safeParse({ productSyncId: "a", quantity: 0 }).success).toBe(false)
    })
})

describe("notificationsMarkReadSchema", () => {
    it("requires markAll or ids", () => {
        expect(notificationsMarkReadSchema.safeParse({ markAllAsRead: true }).success).toBe(true)
        expect(
            notificationsMarkReadSchema.safeParse({ notificationIds: ["a"] }).success,
        ).toBe(true)
        expect(notificationsMarkReadSchema.safeParse({}).success).toBe(false)
    })
})

describe("webPushSubscribeSchema", () => {
    it("validates endpoint URL", () => {
        expect(
            webPushSubscribeSchema.safeParse({
                endpoint: "not-a-url",
                keys: { p256dh: "x", auth: "y" },
            }).success,
        ).toBe(false)
        expect(
            webPushSubscribeSchema.safeParse({
                endpoint: "https://example.com/push/123",
                keys: { p256dh: "x", auth: "y" },
            }).success,
        ).toBe(true)
    })
})

describe("webPushUnsubscribeSchema", () => {
    it("requires endpoint URL", () => {
        expect(webPushUnsubscribeSchema.safeParse({ endpoint: "https://x.test/e" }).success).toBe(
            true,
        )
    })
})

describe("authVerifyMfaSchema", () => {
    it("requires 6-digit numeric code", () => {
        expect(
            authVerifyMfaSchema.safeParse({ email: "a@b.co", code: "123456" }).success,
        ).toBe(true)
        expect(authVerifyMfaSchema.safeParse({ email: "a@b.co", code: "12345" }).success).toBe(
            false,
        )
    })
})

describe("kbFaqImportArraySchema", () => {
    it("rejects empty array", () => {
        expect(kbFaqImportArraySchema.safeParse([]).success).toBe(false)
    })
    it("accepts one valid item", () => {
        expect(
            kbFaqImportArraySchema.safeParse([{ question: "Q?", answer: "A." }]).success,
        ).toBe(true)
    })
})

describe("supplierOfferUpdateSchema", () => {
    it("requires at least one field", () => {
        expect(supplierOfferUpdateSchema.safeParse({}).success).toBe(false)
        expect(supplierOfferUpdateSchema.safeParse({ price: 1 }).success).toBe(true)
    })
})

describe("supplierOrderPatchSchema", () => {
    it("allows empty patch", () => {
        expect(supplierOrderPatchSchema.safeParse({}).success).toBe(true)
    })

    it("requires holdReasonCode when status is On hold", () => {
        expect(
            supplierOrderPatchSchema.safeParse({ fulfillmentStatus: "ON_HOLD" }).success,
        ).toBe(false)
        expect(
            supplierOrderPatchSchema.safeParse({
                fulfillmentStatus: "ON_HOLD",
                holdReasonCode: "inventory_out_of_stock",
            }).success,
        ).toBe(true)
    })

    it("requires holdNote when reason is other", () => {
        expect(
            supplierOrderPatchSchema.safeParse({
                fulfillmentStatus: "ON_HOLD",
                holdReasonCode: "other",
            }).success,
        ).toBe(false)
        expect(
            supplierOrderPatchSchema.safeParse({
                fulfillmentStatus: "ON_HOLD",
                holdReasonCode: "other",
                holdNote: "Custom explanation",
            }).success,
        ).toBe(true)
    })

    it("does not require hold fields for shipped", () => {
        expect(
            supplierOrderPatchSchema.safeParse({
                fulfillmentStatus: "SHIPPED",
                trackingNumber: "1Z",
                trackingCompany: "UPS",
            }).success,
        ).toBe(true)
    })
})

describe("vendorInvitePostSchema", () => {
    it("rejects unknown keys", () => {
        expect(vendorInvitePostSchema.safeParse({ connectToAllStores: true }).success).toBe(true)
        expect(vendorInvitePostSchema.safeParse({ extra: 1 }).success).toBe(false)
    })
})
