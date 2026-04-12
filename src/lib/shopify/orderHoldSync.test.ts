import { describe, it, expect, vi, beforeEach } from "vitest"
import {
    JUNO_ON_HOLD_TAG,
    mergeTagsAddHold,
    mergeTagsRemoveHold,
    buildSupplierHoldMetafieldJson,
} from "@/lib/shopify/orderHoldSync"

describe("orderHoldSync", () => {
    beforeEach(() => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date("2026-04-12T12:00:00.000Z"))
    })

    it("mergeTagsAddHold appends tag once", () => {
        expect(mergeTagsAddHold("foo, bar")).toBe(`foo, bar, ${JUNO_ON_HOLD_TAG}`)
        expect(mergeTagsAddHold(`foo, ${JUNO_ON_HOLD_TAG}`)).toBe(`foo, ${JUNO_ON_HOLD_TAG}`)
        expect(mergeTagsAddHold(`foo, ${JUNO_ON_HOLD_TAG.toLowerCase()}`)).toBe(`foo, ${JUNO_ON_HOLD_TAG.toLowerCase()}`)
    })

    it("mergeTagsRemoveHold strips tag case-insensitively", () => {
        expect(mergeTagsRemoveHold(`a, ${JUNO_ON_HOLD_TAG}, b`)).toBe("a, b")
        expect(mergeTagsRemoveHold("a, b")).toBe("a, b")
    })

    it("buildSupplierHoldMetafieldJson stringifies payload", () => {
        const s = buildSupplierHoldMetafieldJson("inventory_out_of_stock", null)
        expect(JSON.parse(s)).toEqual({
            code: "inventory_out_of_stock",
            note: "",
            updatedAt: "2026-04-12T12:00:00.000Z",
        })
        const s2 = buildSupplierHoldMetafieldJson("other", "  hi  ")
        expect(JSON.parse(s2).note).toBe("hi")
    })
})
