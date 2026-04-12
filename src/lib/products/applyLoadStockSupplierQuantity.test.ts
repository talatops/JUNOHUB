import { describe, it, expect } from "vitest"
import { mergeShopifyProductDataAfterLoadStock } from "./applyLoadStockSupplierQuantity"
import { supplierQuantityFromSyncedProductData } from "./shopifyInventorySum"

describe("mergeShopifyProductDataAfterLoadStock", () => {
    it("decrements explicit supplier_quantity", () => {
        const merged = mergeShopifyProductDataAfterLoadStock({ supplier_quantity: 10, title: "T" }, 3)
        expect(supplierQuantityFromSyncedProductData(merged)).toBe(7)
    })

    it("uses variant sum when supplier_quantity absent", () => {
        const merged = mergeShopifyProductDataAfterLoadStock(
            {
                variants: [{ inventory_quantity: 4 }, { inventory_quantity: 2 }],
            },
            3
        )
        expect(supplierQuantityFromSyncedProductData(merged)).toBe(3)
    })

    it("does not go below zero", () => {
        const merged = mergeShopifyProductDataAfterLoadStock({ supplier_quantity: 2 }, 5)
        expect(supplierQuantityFromSyncedProductData(merged)).toBe(0)
    })

    it("throws when supplier quantity unknown", () => {
        expect(() => mergeShopifyProductDataAfterLoadStock({}, 1)).toThrow("supplier quantity unknown")
    })
})
