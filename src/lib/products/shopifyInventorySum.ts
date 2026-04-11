/**
 * Sum Shopify REST-style variant `inventory_quantity` values (vendor inventory snapshot).
 * Used to seed supplier-facing stock on first product sync so it matches Shopify stock.
 */
export function sumVariantInventoryQuantity(variants: unknown): number | null {
    if (!Array.isArray(variants) || variants.length === 0) return null
    let total = 0
    let hasQty = false
    for (const v of variants) {
        if (v && typeof v === "object" && v !== null && "inventory_quantity" in v) {
            const raw = (v as { inventory_quantity?: unknown }).inventory_quantity
            if (raw !== null && raw !== undefined && raw !== "") {
                const n = Number(raw)
                if (!Number.isNaN(n)) {
                    total += n
                    hasQty = true
                }
            }
        }
    }
    return hasQty ? total : null
}

/**
 * Supplier stock shown for an ACCEPTED ProductSync: persisted `supplier_quantity` (supplier edits),
 * else sum of variant inventory from the last-synced Shopify snapshot (initial parity with Shopify stock).
 */
export function supplierQuantityFromSyncedProductData(productData: unknown): number | undefined {
    const pd =
        productData && typeof productData === "object" && !Array.isArray(productData)
            ? (productData as Record<string, unknown>)
            : {}
    if (typeof pd.supplier_quantity === "number" && !Number.isNaN(pd.supplier_quantity)) {
        return pd.supplier_quantity
    }
    const sum = sumVariantInventoryQuantity(pd.variants)
    return sum !== null ? sum : undefined
}
