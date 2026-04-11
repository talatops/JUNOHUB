import { describe, expect, it } from "vitest"
import {
    sumVariantInventoryQuantity,
    supplierQuantityFromSyncedProductData,
} from "./shopifyInventorySum"

describe("sumVariantInventoryQuantity", () => {
    it("sums numeric inventory_quantity across variants", () => {
        expect(
            sumVariantInventoryQuantity([
                { inventory_quantity: 10 },
                { inventory_quantity: 7 },
            ]),
        ).toBe(17)
    })

    it("returns null when no usable quantities", () => {
        expect(sumVariantInventoryQuantity([])).toBeNull()
        expect(sumVariantInventoryQuantity([{ sku: "x" }])).toBeNull()
    })
})

describe("supplierQuantityFromSyncedProductData", () => {
    it("prefers supplier_quantity when set", () => {
        expect(
            supplierQuantityFromSyncedProductData({
                supplier_quantity: 3,
                variants: [{ inventory_quantity: 99 }],
            }),
        ).toBe(3)
    })

    it("falls back to variant sum", () => {
        expect(
            supplierQuantityFromSyncedProductData({
                variants: [{ inventory_quantity: 4 }, { inventory_quantity: 5 }],
            }),
        ).toBe(9)
    })
})
