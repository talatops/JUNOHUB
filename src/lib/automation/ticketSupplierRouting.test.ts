import { describe, expect, it } from "vitest"
import { parseLineItems } from "@/lib/automation/ticketSupplierRouting"

describe("parseLineItems", () => {
    it("maps Shopify-style line items", () => {
        const raw = [
            {
                product_id: 12_345,
                title: "Blue shoes",
                sku: "SKU-1",
                quantity: 2,
            },
            { product_id: 99, name: "Hat", quantity: 1 },
        ]
        const out = parseLineItems(raw)
        expect(out).toHaveLength(2)
        expect(out[0]).toMatchObject({
            lineIndex: 0,
            title: "Blue shoes",
            sku: "SKU-1",
            quantity: 2,
            shopifyProductId: "12345",
        })
        expect(out[1]).toMatchObject({
            lineIndex: 1,
            title: "Hat",
            shopifyProductId: "99",
            quantity: 1,
        })
    })

    it("returns empty for non-array", () => {
        expect(parseLineItems(null)).toEqual([])
        expect(parseLineItems({})).toEqual([])
    })
})
