import { describe, expect, it } from "vitest"
import {
    normalizeProductTitle,
    pickMatchingSupplierOffer,
    resolveSupplierQuantityFromOffers,
    type SupplierOfferForMatching,
} from "./autoLinkOfferToShopifyProduct"

describe("normalizeProductTitle", () => {
    it("trims and lowercases and collapses whitespace", () => {
        expect(normalizeProductTitle("  Hello   WORLD  ")).toBe("hello world")
    })

    it("handles empty string", () => {
        expect(normalizeProductTitle("   ")).toBe("")
    })
})

describe("pickMatchingSupplierOffer", () => {
    const a: SupplierOfferForMatching = {
        supplierId: "s1",
        offerQuantity: 10,
        product: { title: "Blue Widget", sku: "BW-1" },
    }
    const b: SupplierOfferForMatching = {
        supplierId: "s2",
        offerQuantity: 20,
        product: { title: "Blue Widget", sku: "BW-2" },
    }
    const c: SupplierOfferForMatching = {
        supplierId: "s3",
        offerQuantity: 3,
        product: { title: "Red Hat", sku: "RH-99" },
    }

    it("returns single title match", () => {
        expect(
            pickMatchingSupplierOffer([a, c], "blue widget", new Set()),
        ).toEqual(a)
    })

    it("disambiguates multiple title matches by SKU", () => {
        expect(
            pickMatchingSupplierOffer([a, b], "blue widget", new Set(["BW-2"])),
        ).toEqual(b)
    })

    it("returns null when multiple title matches and SKU not unique", () => {
        expect(
            pickMatchingSupplierOffer([a, b], "blue widget", new Set()),
        ).toBeNull()
    })

    it("uses SKU-only when no title match", () => {
        expect(
            pickMatchingSupplierOffer([a, b, c], "unknown title", new Set(["RH-99"])),
        ).toEqual(c)
    })

    it("returns null for ambiguous SKU-only", () => {
        expect(
            pickMatchingSupplierOffer([a, b], "x", new Set(["BW-1", "BW-2"])),
        ).toBeNull()
    })

    it("returns null for empty offers", () => {
        expect(pickMatchingSupplierOffer([], "t", new Set(["x"]))).toBeNull()
    })
})

describe("resolveSupplierQuantityFromOffers", () => {
    it("returns quantity from single title match", () => {
        expect(
            resolveSupplierQuantityFromOffers(
                "HandBags",
                { variants: [{ sku: "HB-1" }] },
                [
                    {
                        supplierId: "s1",
                        quantity: 5,
                        product: { title: "HandBags", sku: "HB-1" },
                    },
                ],
            ),
        ).toBe(5)
    })

    it("returns undefined when no match", () => {
        expect(
            resolveSupplierQuantityFromOffers(
                "Other",
                {},
                [
                    {
                        supplierId: "s1",
                        quantity: 5,
                        product: { title: "HandBags", sku: "HB-1" },
                    },
                ],
            ),
        ).toBeUndefined()
    })
})
