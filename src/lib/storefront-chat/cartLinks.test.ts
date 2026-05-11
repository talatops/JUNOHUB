import { describe, expect, it } from "vitest"
import {
    buildCartPermalink,
    extractCartableVariants,
    selectVariantForCart,
} from "./cartLinks"

describe("storefront cart links", () => {
    const variants = [
        {
            id: 111,
            title: "Default Title",
            sku: "SHOE-1",
            price: "25.00",
            inventory_quantity: 4,
        },
    ]

    it("selects a single cartable variant", () => {
        const result = selectVariantForCart({
            variants: extractCartableVariants(variants),
            message: "add it",
        })
        expect(result.status).toBe("selected")
        if (result.status === "selected") {
            expect(result.variant.id).toBe("111")
        }
    })

    it("asks for a variant when multiple meaningful options exist", () => {
        const result = selectVariantForCart({
            variants: extractCartableVariants([
                { id: 1, title: "Black / 8", option1: "Black", option2: "8", inventory_quantity: 2 },
                { id: 2, title: "Black / 9", option1: "Black", option2: "9", inventory_quantity: 2 },
            ]),
            message: "yes",
        })
        expect(result.status).toBe("needs_selection")
    })

    it("rejects requested variants that are not in the cached product", () => {
        const result = selectVariantForCart({
            variants: extractCartableVariants(variants),
            requestedVariantId: "999",
        })
        expect(result.status).toBe("invalid_variant")
    })

    it("builds Shopify cart permalinks with normalized domains and bounded quantities", () => {
        expect(
            buildCartPermalink("https://demo.myshopify.com/", [
                { variantId: "111", quantity: 2 },
                { variantId: "222", quantity: 25 },
            ]),
        ).toBe("https://demo.myshopify.com/cart/111:2,222:10")
    })
})
