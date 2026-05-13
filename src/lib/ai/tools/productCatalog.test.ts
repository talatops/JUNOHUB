import { describe, expect, it } from "vitest"
import {
    isProductStatusSellable,
    parseLinkedProductIdsFromMetafields,
    tokenizeSearchTerms,
} from "@/lib/ai/tools/productCatalog"

describe("productCatalog helpers", () => {
    it("treats active and published statuses as sellable", () => {
        expect(isProductStatusSellable("active")).toBe(true)
        expect(isProductStatusSellable("ACTIVE")).toBe(true)
        expect(isProductStatusSellable("published")).toBe(true)
        expect(isProductStatusSellable("draft")).toBe(false)
        expect(isProductStatusSellable(null)).toBe(false)
    })

    it("parses linked product ids from juno metafields", () => {
        const ids = parseLinkedProductIdsFromMetafields([
            { namespace: "juno", key: "upsell_links", value: "gid://shopify/Product/1, gid://shopify/Product/2" },
            { namespace: "other", key: "upsell_links", value: "ignored" },
        ])
        expect(ids).toEqual(["gid://shopify/Product/1", "gid://shopify/Product/2"])
    })

    it("tokenizes search terms consistently", () => {
        expect(tokenizeSearchTerms("Need USB-C charger for iPhone 15", 4)).toEqual([
            "need",
            "usb",
            "charger",
            "for",
        ])
    })
})
