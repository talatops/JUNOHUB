import { describe, it, expect } from "vitest"
import {
    shopifyFulfillmentHoldReason,
    shopifyFulfillmentHoldNotes,
    JUNO_FULFILLMENT_HOLD_HANDLE,
} from "@/lib/shopify/fulfillmentOrderHoldGraphql"

describe("fulfillmentOrderHoldGraphql", () => {
    it("maps supplier codes to Shopify FulfillmentHoldReason", () => {
        expect(shopifyFulfillmentHoldReason("inventory_out_of_stock")).toBe("INVENTORY_OUT_OF_STOCK")
        expect(shopifyFulfillmentHoldReason("address_incorrect")).toBe("INCORRECT_ADDRESS")
        expect(shopifyFulfillmentHoldReason("high_risk_fraud")).toBe("HIGH_RISK_OF_FRAUD")
        expect(shopifyFulfillmentHoldReason("awaiting_payment")).toBe("AWAITING_PAYMENT")
        expect(shopifyFulfillmentHoldReason("other")).toBe("OTHER")
    })

    it("builds reason notes for Shopify admin", () => {
        expect(shopifyFulfillmentHoldNotes("inventory_out_of_stock", null)).toContain("Inventory out of stock")
        expect(shopifyFulfillmentHoldNotes("other", "  custom  ")).toBe("custom")
        expect(shopifyFulfillmentHoldNotes("awaiting_payment", "extra")).toContain("Awaiting payment")
    })

    it("uses stable hold handle for release targeting", () => {
        expect(JUNO_FULFILLMENT_HOLD_HANDLE.length).toBeLessThanOrEqual(64)
    })
})
