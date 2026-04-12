import type { Prisma } from "@prisma/client"
import { supplierQuantityFromSyncedProductData } from "@/lib/products/shopifyInventorySum"

/**
 * After a successful Shopify inventory increase, persist reduced supplier-available stock
 * on ProductSync.shopifyProductData by setting explicit `supplier_quantity`.
 */
export function mergeShopifyProductDataAfterLoadStock(
    shopifyProductData: unknown,
    decrementBy: number
): Prisma.InputJsonValue {
    const current = supplierQuantityFromSyncedProductData(shopifyProductData)
    if (current === undefined) {
        throw new Error("supplier quantity unknown")
    }
    const next = Math.max(0, current - decrementBy)
    const base =
        shopifyProductData && typeof shopifyProductData === "object" && !Array.isArray(shopifyProductData)
            ? { ...(shopifyProductData as Record<string, unknown>) }
            : {}
    return { ...base, supplier_quantity: next } as Prisma.InputJsonValue
}
