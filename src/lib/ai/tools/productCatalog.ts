export type CachedProductLite = {
    shopifyProductId: string
    title: string
    vendor: string | null
    productType: string | null
    status: string | null
    variants: unknown
    metafields: unknown
}

export function tokenizeSearchTerms(text: string, maxTerms = 8): string[] {
    return text
        .toLowerCase()
        .split(/[^a-z0-9]+/g)
        .map((t) => t.trim())
        .filter((t) => t.length >= 2)
        .slice(0, maxTerms)
}

export function scoreByTerms(text: string, terms: string[]): number {
    if (!text || terms.length === 0) return 0
    const hay = text.toLowerCase()
    let score = 0
    for (const t of terms) {
        if (hay.includes(t)) score += 1
    }
    return score
}

export function compactText(value: string, max = 420): string {
    if (value.length <= max) return value
    return `${value.slice(0, max - 1)}...`
}

export function isProductStatusSellable(status: string | null | undefined): boolean {
    const normalized = String(status || "")
        .trim()
        .toLowerCase()
    return normalized === "active" || normalized === "published"
}

export function metafieldsToSummary(metafields: unknown, maxValueLength = 240): string {
    if (!Array.isArray(metafields) || metafields.length === 0) return ""
    const parts: string[] = []
    for (const row of metafields) {
        if (!row || typeof row !== "object") continue
        const r = row as { namespace?: string; key?: string; value?: unknown }
        const key = typeof r.key === "string" ? r.key.trim() : ""
        const value = r.value
        const rendered = value == null ? "" : String(value).trim()
        if (!key || !rendered) continue
        const ns = typeof r.namespace === "string" && r.namespace.trim() ? `${r.namespace.trim()}.` : ""
        parts.push(`${ns}${key}: ${rendered.slice(0, maxValueLength)}`)
    }
    return parts.join(" | ")
}

export function primarySkuFromVariants(variants: unknown): string | null {
    try {
        const parsed = typeof variants === "string" ? JSON.parse(variants) : variants
        if (!Array.isArray(parsed) || parsed.length === 0) return null
        const first = parsed[0] as { sku?: unknown }
        const sku = first?.sku == null ? "" : String(first.sku).trim()
        return sku || null
    } catch {
        return null
    }
}

export function inventorySummaryFromVariants(variants: unknown): string | null {
    try {
        const parsed = typeof variants === "string" ? JSON.parse(variants) : variants
        if (!Array.isArray(parsed) || parsed.length === 0) return null
        const first = parsed[0] as { inventory_quantity?: unknown; sku?: unknown }
        const qty = typeof first?.inventory_quantity === "number" ? first.inventory_quantity : null
        const sku = first?.sku == null ? "" : String(first.sku).trim()
        if (qty == null && !sku) return null
        return [sku ? `SKU ${sku}` : null, qty != null ? `qty ${qty}` : null]
            .filter(Boolean)
            .join(", ")
    } catch {
        return null
    }
}

export function buildCatalogSearchText(product: CachedProductLite): string {
    return [
        product.title || "",
        product.vendor || "",
        product.productType || "",
        primarySkuFromVariants(product.variants) || "",
        JSON.stringify(product.variants || ""),
        metafieldsToSummary(product.metafields, 300),
    ]
        .filter(Boolean)
        .join(" ")
}

export function parseLinkedProductIdsFromMetafields(metafields: unknown): string[] {
    if (!Array.isArray(metafields) || metafields.length === 0) return []
    const out = new Set<string>()
    for (const row of metafields) {
        if (!row || typeof row !== "object") continue
        const r = row as { namespace?: unknown; key?: unknown; value?: unknown }
        const ns = typeof r.namespace === "string" ? r.namespace.toLowerCase().trim() : ""
        const key = typeof r.key === "string" ? r.key.toLowerCase().trim() : ""
        const value = typeof r.value === "string" ? r.value.trim() : ""
        const looksLinkedField =
            ns === "juno" &&
            (key === "upsell_links" || key === "related_product_ids" || key === "upsell_product_ids")
        if (!looksLinkedField || !value) continue
        for (const token of value.split(/[,|\n]/g)) {
            const id = token.trim()
            if (id) out.add(id)
        }
    }
    return Array.from(out)
}
