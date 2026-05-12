import { describe, expect, it } from "vitest"
import { computeAiRevenueAttribution, parseOrderLineItems } from "./revenueAttribution"

describe("revenueAttribution", () => {
    it("parses Shopify line item identifiers conservatively", () => {
        expect(
            parseOrderLineItems([
                { product_id: 123, variant_id: 456, title: "Socks", quantity: 2, price: "4.50" },
            ]),
        ).toEqual([
            { productId: "123", variantId: "456", title: "Socks", quantity: 2, price: 4.5 },
        ])
    })

    it("attributes direct upsell revenue only when the clicked product is in a matching order", () => {
        const result = computeAiRevenueAttribution({
            events: [
                {
                    id: "event-1",
                    conversationId: "conv-1",
                    eventType: "upsell_clicked",
                    productId: "p-upsell",
                    variantId: "v-upsell",
                    quantity: 1,
                    createdAt: new Date("2026-05-01T10:00:00Z"),
                },
                {
                    id: "event-2",
                    conversationId: "conv-1",
                    eventType: "customer_question",
                    productId: null,
                    variantId: null,
                    quantity: null,
                    createdAt: new Date("2026-05-01T09:59:00Z"),
                },
            ],
            conversations: [
                {
                    id: "conv-1",
                    customerEmail: "buyer@example.com",
                    boundShopifyOrderId: null,
                    createdAt: new Date("2026-05-01T09:58:00Z"),
                    updatedAt: new Date("2026-05-01T10:02:00Z"),
                },
            ],
            orders: [
                {
                    shopifyOrderId: "order-1",
                    orderNumber: "#1001",
                    email: "buyer@example.com",
                    totalPrice: "50.00",
                    currency: "GBP",
                    shopifyCreatedAt: new Date("2026-05-01T10:10:00Z"),
                    createdAt: new Date("2026-05-01T10:10:00Z"),
                    lineItems: [
                        { product_id: "p-base", variant_id: "v-base", title: "Shoes", quantity: 1, price: "40.00" },
                        { product_id: "p-upsell", variant_id: "v-upsell", title: "Socks", quantity: 2, price: "5.00" },
                    ],
                },
            ],
        })

        expect(result.directUpsellRevenue).toBe(10)
        expect(result.aiAssistedRevenue).toBe(50)
        expect(result.directRows).toHaveLength(1)
        expect(result.assistedRows).toHaveLength(1)
    })

    it("does not inflate direct revenue without exact product or variant matching", () => {
        const result = computeAiRevenueAttribution({
            events: [
                {
                    id: "event-1",
                    conversationId: "conv-1",
                    eventType: "upsell_clicked",
                    productId: "p-clicked",
                    variantId: "v-clicked",
                    quantity: 1,
                    createdAt: new Date("2026-05-01T10:00:00Z"),
                },
            ],
            conversations: [
                {
                    id: "conv-1",
                    customerEmail: "buyer@example.com",
                    boundShopifyOrderId: null,
                    createdAt: new Date("2026-05-01T09:58:00Z"),
                    updatedAt: new Date("2026-05-01T10:02:00Z"),
                },
            ],
            orders: [
                {
                    shopifyOrderId: "order-1",
                    orderNumber: "#1001",
                    email: "buyer@example.com",
                    totalPrice: "50.00",
                    currency: "GBP",
                    shopifyCreatedAt: new Date("2026-05-01T10:10:00Z"),
                    createdAt: new Date("2026-05-01T10:10:00Z"),
                    lineItems: [{ product_id: "p-other", variant_id: "v-other", title: "Shoes", quantity: 1, price: "50.00" }],
                },
            ],
        })

        expect(result.directUpsellRevenue).toBe(0)
        expect(result.directRows).toHaveLength(0)
    })

    it("matches anonymous storefront orders through JUNO cart note attributes", () => {
        const result = computeAiRevenueAttribution({
            events: [
                {
                    id: "event-1",
                    conversationId: "conv-anon",
                    eventType: "upsell_clicked",
                    productId: "p-upsell",
                    variantId: "v-upsell",
                    quantity: 1,
                    createdAt: new Date("2026-05-01T10:00:00Z"),
                },
                {
                    id: "event-2",
                    conversationId: "conv-anon",
                    eventType: "customer_question",
                    productId: null,
                    variantId: null,
                    quantity: null,
                    createdAt: new Date("2026-05-01T09:59:00Z"),
                },
            ],
            conversations: [
                {
                    id: "conv-anon",
                    customerEmail: null,
                    boundShopifyOrderId: null,
                    createdAt: new Date("2026-05-01T09:58:00Z"),
                    updatedAt: new Date("2026-05-01T10:02:00Z"),
                },
            ],
            orders: [
                {
                    shopifyOrderId: "order-1",
                    orderNumber: "#1001",
                    email: "checkout@example.com",
                    totalPrice: "25.00",
                    currency: "GBP",
                    shopifyCreatedAt: new Date("2026-05-01T10:10:00Z"),
                    createdAt: new Date("2026-05-01T10:10:00Z"),
                    noteAttributes: [
                        { name: "juno_ai_conversation_id", value: "conv-anon" },
                        { name: "juno_ai_source", value: "upsell" },
                    ],
                    lineItems: [
                        { product_id: "p-upsell", variant_id: "v-upsell", title: "Socks", quantity: 1, price: "5.00" },
                        { product_id: "p-base", variant_id: "v-base", title: "Shoes", quantity: 1, price: "20.00" },
                    ],
                },
            ],
        })

        expect(result.directUpsellRevenue).toBe(5)
        expect(result.aiAssistedRevenue).toBe(25)
        expect(result.directRows).toHaveLength(1)
        expect(result.assistedRows).toHaveLength(1)
    })
})
