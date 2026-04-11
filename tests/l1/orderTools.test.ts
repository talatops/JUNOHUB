import { describe, expect, it } from "vitest"
import { orderNeedsDisambiguation } from "@/lib/ai/tools/orderTools"
import type { OrderListCandidate } from "@/lib/ai/tools/orderTools"

const mk = (n: string): OrderListCandidate => ({
    shopifyOrderId: n,
    orderNumber: n,
    shopifyCreatedAt: null,
    financialStatus: null,
    fulfillmentStatus: null,
    totalPrice: "1",
    currency: "USD",
})

describe("orderNeedsDisambiguation", () => {
    it("returns false for single candidate", () => {
        expect(orderNeedsDisambiguation("a@b.com", "help", [mk("1001")])).toBe(false)
    })

    it("returns true for multiple candidates without hints", () => {
        expect(orderNeedsDisambiguation("a@b.com", "where is my order", [mk("1001"), mk("1002")])).toBe(
            true,
        )
    })

    it("returns false when hint matches one order", () => {
        expect(
            orderNeedsDisambiguation("a@b.com", "order 1002", [mk("1001"), mk("1002")]),
        ).toBe(false)
    })
})
