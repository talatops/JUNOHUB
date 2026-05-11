import { beforeEach, describe, expect, it, vi } from "vitest"
import { GET } from "./route"

vi.mock("@/auth", () => ({
    auth: vi.fn(),
}))

vi.mock("@/lib/dashboard/vendorActiveStore", () => ({
    getVendorActiveStore: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
    prisma: {
        storefrontChatMessage: { findMany: vi.fn() },
        aiAnalyticsEvent: { findMany: vi.fn() },
        storefrontChatConversation: { findMany: vi.fn() },
        cachedOrder: { findMany: vi.fn() },
        chatMessage: { findMany: vi.fn() },
        emailLog: { findMany: vi.fn() },
    },
}))

beforeEach(() => {
    vi.clearAllMocks()
})

describe("GET /api/dashboard/ai-analytics", () => {
    it("returns business outcome analytics instead of technical model KPIs", async () => {
        const { auth } = await import("@/auth")
        const { getVendorActiveStore } = await import("@/lib/dashboard/vendorActiveStore")
        const { prisma } = await import("@/lib/prisma")

        vi.mocked(auth).mockResolvedValue({ user: { id: "user-1", role: "VENDOR" } } as never)
        vi.mocked(getVendorActiveStore).mockResolvedValue({ id: "store-1", userId: "user-1" } as never)
        vi.mocked(prisma.storefrontChatMessage.findMany).mockResolvedValue([
            {
                id: "m1",
                senderType: "CUSTOMER",
                createdAt: new Date("2026-05-01T10:00:00Z"),
                content: "Do you have school shoes?",
                conversationId: "conv-1",
                actions: null,
            },
            {
                id: "m2",
                senderType: "AI",
                createdAt: new Date("2026-05-01T10:00:03Z"),
                content: "Yes, we have school shoes.",
                conversationId: "conv-1",
                actions: null,
            },
        ] as never)
        vi.mocked(prisma.aiAnalyticsEvent.findMany).mockResolvedValue([
            {
                id: "event-1",
                conversationId: "conv-1",
                messageId: "m1",
                eventType: "customer_question",
                source: "storefront_chat",
                productId: null,
                variantId: null,
                quantity: null,
                amount: null,
                currency: null,
                sentiment: "neutral",
                resolutionStatus: null,
                orderId: null,
                attributionType: null,
                metadata: null,
                createdAt: new Date("2026-05-01T10:00:00Z"),
            },
            {
                id: "event-2",
                conversationId: "conv-1",
                messageId: "m2",
                eventType: "resolved_by_ai",
                source: "storefront_chat",
                productId: null,
                variantId: null,
                quantity: null,
                amount: null,
                currency: null,
                sentiment: null,
                resolutionStatus: "resolved_by_ai",
                orderId: null,
                attributionType: null,
                metadata: null,
                createdAt: new Date("2026-05-01T10:00:03Z"),
            },
        ] as never)
        vi.mocked(prisma.storefrontChatConversation.findMany).mockResolvedValue([
            {
                id: "conv-1",
                visitorId: "visitor-1",
                customerEmail: null,
                boundShopifyOrderId: null,
                createdAt: new Date("2026-05-01T09:59:00Z"),
                updatedAt: new Date("2026-05-01T10:00:03Z"),
            },
        ] as never)
        vi.mocked(prisma.cachedOrder.findMany).mockResolvedValue([] as never)
        vi.mocked(prisma.chatMessage.findMany).mockResolvedValue([] as never)
        vi.mocked(prisma.emailLog.findMany).mockResolvedValue([] as never)

        const res = await GET(new Request("http://localhost/api/dashboard/ai-analytics?range=30d"))
        const json = await res.json()

        expect(res.status).toBe(200)
        expect(json.modelEvaluation).toBeUndefined()
        expect(json.revenueImpact).toMatchObject({
            directUpsellRevenue: 0,
            aiAssistedRevenue: 0,
        })
        expect(json.customerExperience.sentimentMix.totals.neutral).toBe(1)
        expect(json.automationOutcomes.questionsAnswered).toBe(1)
        expect(Array.isArray(json.timeline)).toBe(true)
    })

    it("derives real metrics from existing messages when persisted analytics events are not backfilled yet", async () => {
        const { auth } = await import("@/auth")
        const { getVendorActiveStore } = await import("@/lib/dashboard/vendorActiveStore")
        const { prisma } = await import("@/lib/prisma")

        vi.mocked(auth).mockResolvedValue({ user: { id: "user-1", role: "VENDOR" } } as never)
        vi.mocked(getVendorActiveStore).mockResolvedValue({ id: "store-1", userId: "user-1" } as never)
        vi.mocked(prisma.storefrontChatMessage.findMany).mockResolvedValue([
            {
                id: "m1",
                senderType: "CUSTOMER",
                createdAt: new Date("2026-05-01T10:00:00Z"),
                content: "Thank you, do you have sandals?",
                conversationId: "conv-1",
                actions: null,
            },
            {
                id: "m2",
                senderType: "AI",
                createdAt: new Date("2026-05-01T10:00:03Z"),
                content: "Yes, we have sandals available.",
                conversationId: "conv-1",
                actions: [
                    {
                        type: "upsell_suggestion",
                        label: "Add suggested item",
                        message: "Would you like socks too?",
                        product: { productId: "p2", title: "Socks", variantId: "v2", price: "5.00" },
                    },
                ],
            },
        ] as never)
        vi.mocked(prisma.aiAnalyticsEvent.findMany).mockResolvedValue([] as never)
        vi.mocked(prisma.storefrontChatConversation.findMany).mockResolvedValue([
            {
                id: "conv-1",
                visitorId: "visitor-1",
                customerEmail: "buyer@example.com",
                boundShopifyOrderId: "order-1",
                createdAt: new Date("2026-05-01T09:59:00Z"),
                updatedAt: new Date("2026-05-01T10:00:03Z"),
            },
        ] as never)
        vi.mocked(prisma.cachedOrder.findMany).mockResolvedValue([
            {
                shopifyOrderId: "order-1",
                orderNumber: "#1001",
                email: "buyer@example.com",
                totalPrice: "30.00",
                currency: "GBP",
                lineItems: [],
                shopifyCreatedAt: new Date("2026-05-01T10:10:00Z"),
                createdAt: new Date("2026-05-01T10:10:00Z"),
            },
        ] as never)
        vi.mocked(prisma.chatMessage.findMany).mockResolvedValue([] as never)
        vi.mocked(prisma.emailLog.findMany).mockResolvedValue([] as never)

        const res = await GET(new Request("http://localhost/api/dashboard/ai-analytics?range=30d"))
        const json = await res.json()

        expect(res.status).toBe(200)
        expect(json.customerExperience.sentimentMix.totals.positive).toBe(1)
        expect(json.automationOutcomes.resolvedByAi).toBe(1)
        expect(json.revenueImpact.aiAssistedRevenue).toBe(30)
        expect(json.technicalDiagnostics.derivedAnalyticsEvents).toBeGreaterThan(0)
    })
})
