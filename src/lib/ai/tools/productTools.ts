import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"

export type ProductSearchHit = {
    shopifyProductId: string
    title: string
    sku: string | null
    inventorySummary: string | null
    metafieldsSummary: string | null
}

function metafieldsToSummary(metafields: unknown): string | null {
    if (!Array.isArray(metafields) || metafields.length === 0) return null
    const parts: string[] = []
    for (const row of metafields) {
        if (!row || typeof row !== "object") continue
        const r = row as { namespace?: string; key?: string; value?: string | null }
        const k = r.key
        const v = r.value
        if (!k || v === null || v === undefined || String(v).trim() === "") continue
        const ns = r.namespace ? `${r.namespace}.` : ""
        parts.push(`${ns}${k}: ${String(v).slice(0, 400)}`)
    }
    return parts.length ? parts.join(" | ") : null
}

function inventoryFromVariants(variants: unknown): string | null {
    try {
        const v =
            typeof variants === "string" ? JSON.parse(variants) : variants
        if (!Array.isArray(v) || v.length === 0) return null
        const first = v[0] as { inventory_quantity?: number; sku?: string }
        const q = first.inventory_quantity
        const sku = first.sku
        if (q === undefined && !sku) return null
        return [sku ? `SKU ${sku}` : null, q !== undefined ? `qty ${q}` : null]
            .filter(Boolean)
            .join(", ")
    } catch {
        return null
    }
}

/**
 * Keyword search by title / SKU across cached products (MVP; no full-text index).
 */
export async function searchProductsForStore(
    storeId: string,
    query: string,
    limit = 8,
): Promise<ProductSearchHit[]> {
    const terms = query
        .toLowerCase()
        .split(/[^a-z0-9]+/g)
        .map((t) => t.trim())
        .filter((t) => t.length >= 2)
        .slice(0, 6)

    if (!terms.length) return []

    try {
        const products = await prisma.cachedProduct.findMany({
            where: { storeId },
            orderBy: { updatedAt: "desc" },
            take: 400,
            select: {
                shopifyProductId: true,
                title: true,
                variants: true,
                metafields: true,
            },
        })

        const scored: { p: (typeof products)[0]; score: number }[] = []
        for (const p of products) {
            const hay = `${p.title} ${JSON.stringify(p.variants)}`.toLowerCase()
            let score = 0
            for (const t of terms) {
                if (hay.includes(t)) score += 1
            }
            if (score > 0) scored.push({ p, score })
        }
        scored.sort((a, b) => b.score - a.score)

        return scored.slice(0, limit).map(({ p }) => {
            const variants = p.variants
            let sku: string | null = null
            try {
                const arr =
                    typeof variants === "string" ? JSON.parse(variants) : variants
                if (Array.isArray(arr) && arr[0]?.sku) sku = String(arr[0].sku)
            } catch {
                /* ignore */
            }
            return {
                shopifyProductId: p.shopifyProductId,
                title: p.title,
                sku,
                inventorySummary: inventoryFromVariants(p.variants),
                metafieldsSummary: metafieldsToSummary(p.metafields),
            }
        })
    } catch (e) {
        logger.error("searchProductsForStore failed", e)
        return []
    }
}

/**
 * When categoryMetadetailsEnabled, expose metafield text for grounded answers.
 */
export async function getProductMetafieldsForL1(
    storeId: string,
    shopifyProductId: string,
    categoryMetadetailsEnabled: boolean,
): Promise<{ metafieldsSummary: string | null }> {
    if (!categoryMetadetailsEnabled) {
        return { metafieldsSummary: null }
    }
    try {
        const row = await prisma.cachedProduct.findFirst({
            where: { storeId, shopifyProductId },
            select: { metafields: true },
        })
        return { metafieldsSummary: metafieldsToSummary(row?.metafields) }
    } catch (e) {
        logger.error("getProductMetafieldsForL1 failed", e)
        return { metafieldsSummary: null }
    }
}
