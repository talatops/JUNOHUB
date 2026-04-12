import { describe, expect, it } from "vitest"
import { shouldSendLowStockSupplierMessage } from "@/lib/automation/lowStockNotifyGate"

describe("shouldSendLowStockSupplierMessage", () => {
    it("returns false when qty is at or above threshold", () => {
        expect(
            shouldSendLowStockSupplierMessage({
                newQty: 5,
                threshold: 5,
                prevQty: 2,
                lastNotifiedBelowAt: null,
            }),
        ).toBe(false)
        expect(
            shouldSendLowStockSupplierMessage({
                newQty: 10,
                threshold: 5,
                prevQty: 10,
                lastNotifiedBelowAt: null,
            }),
        ).toBe(false)
    })

    it("returns true on first observation below threshold", () => {
        expect(
            shouldSendLowStockSupplierMessage({
                newQty: 3,
                threshold: 5,
                prevQty: null,
                lastNotifiedBelowAt: null,
            }),
        ).toBe(true)
    })

    it("returns true when crossing from above to below", () => {
        expect(
            shouldSendLowStockSupplierMessage({
                newQty: 4,
                threshold: 5,
                prevQty: 6,
                lastNotifiedBelowAt: null,
            }),
        ).toBe(true)
    })

    it("returns false while staying below after a notification", () => {
        expect(
            shouldSendLowStockSupplierMessage({
                newQty: 2,
                threshold: 5,
                prevQty: 3,
                lastNotifiedBelowAt: new Date(),
            }),
        ).toBe(false)
    })
})
