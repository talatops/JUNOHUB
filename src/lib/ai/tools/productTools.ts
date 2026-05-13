import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import type { StorefrontActionProduct } from "@/lib/storefront-chat/actions"
import { extractCartableVariants, selectVariantForCart } from "@/lib/storefront-chat/cartLinks"

export type ProductSearchHit = {
    shopifyProductId: string
    title: string
    sku: string | null
    inventorySummary: string | null
    metafieldsSummary: string | null
    productType: string | null
    status: string | null
    variantId: string | null
    variantTitle: string | null
    price: string | null
    inventoryQuantity: number | null
    imageUrl: string | null
    tokens: string[]
    requiresVariantSelection: boolean
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

function imageUrlFromImages(images: unknown): string | null {
    const rows = typeof images === "string"
        ? (() => {
              try {
                  return JSON.parse(images) as unknown
              } catch {
                  return []
              }
          })()
        : images
    if (!Array.isArray(rows)) return null
    for (const row of rows) {
        if (!row || typeof row !== "object") continue
        const image = row as { src?: unknown; url?: unknown }
        const src = typeof image.src === "string" ? image.src : typeof image.url === "string" ? image.url : ""
        if (src.trim()) return src.trim()
    }
    return null
}

function termsFromText(text: string) {
    const ignored = new Set([
        "want",
        "wants",
        "buy",
        "some",
        "sort",
        "kind",
        "need",
        "needs",
        "looking",
        "please",
        "product",
        "products",
        "item",
        "items",
        "show",
        "have",
        "with",
        "that",
        "this",
        "your",
    ])
    return text
        .toLowerCase()
        .split(/[^a-z0-9]+/g)
        .map((t) => t.trim())
        .filter((t) => t.length >= 2 && !ignored.has(t))
}

export function productSearchHitToActionProduct(hit: ProductSearchHit): StorefrontActionProduct | null {
    if (!hit.variantId) return null
    return {
        productId: hit.shopifyProductId,
        title: hit.title,
        variantId: hit.variantId,
        variantTitle: hit.variantTitle,
        sku: hit.sku,
        price: hit.price,
        imageUrl: hit.imageUrl,
        productType: hit.productType,
        quantity: 1,
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
    const terms = termsFromText(query).slice(0, 6)

    if (!terms.length) return []

    try {
        const products = await prisma.cachedProduct.findMany({
            where: { storeId },
            orderBy: { updatedAt: "desc" },
            take: 2000,
            select: {
                shopifyProductId: true,
                title: true,
                productType: true,
                status: true,
                variants: true,
                images: true,
                metafields: true,
            },
        })

        const scored: { p: (typeof products)[0]; score: number }[] = []
        for (const p of products) {
            const title = p.title.toLowerCase()
            const productType = (p.productType ?? "").toLowerCase()
            const variantsText = JSON.stringify(p.variants).toLowerCase()
            const metafieldsText = (metafieldsToSummary(p.metafields) ?? "").toLowerCase()
            const hay = `${title} ${productType} ${variantsText} ${metafieldsText}`
            let score = 0
            for (const t of terms) {
                if (title.includes(t)) score += 8
                if (productType.includes(t)) score += 4
                if (variantsText.includes(t)) score += 2
                if (metafieldsText.includes(t)) score += 1
                if (hay.includes(t)) score += 1
            }
            if (score > 0) scored.push({ p, score })
        }
        scored.sort((a, b) => b.score - a.score || a.p.title.localeCompare(b.p.title))

        return scored.slice(0, limit).map(({ p }) => {
            const variants = extractCartableVariants(p.variants)
            const selected = selectVariantForCart({ variants, message: query })
            const selectedVariant = selected.status === "selected" ? selected.variant : null
            const firstVariant = variants[0] ?? null
            let sku: string | null = null
            if (selectedVariant?.sku) sku = selectedVariant.sku
            else if (firstVariant?.sku) sku = firstVariant.sku

            const tokens = Array.from(new Set([
                ...termsFromText(p.title),
                ...termsFromText(p.productType ?? ""),
            ])).slice(0, 16)

            return {
                shopifyProductId: p.shopifyProductId,
                title: p.title,
                sku,
                inventorySummary: inventoryFromVariants(p.variants),
                metafieldsSummary: metafieldsToSummary(p.metafields),
                productType: p.productType,
                status: p.status,
                variantId: selectedVariant?.id ?? null,
                variantTitle: selectedVariant?.title ?? null,
                price: selectedVariant?.price ?? firstVariant?.price ?? null,
                inventoryQuantity: selectedVariant?.inventoryQuantity ?? firstVariant?.inventoryQuantity ?? null,
                imageUrl: imageUrlFromImages(p.images),
                tokens,
                requiresVariantSelection: selected.status === "needs_selection",
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
        return { metafieldsSummary: metafieldsToSummary(row?.metafields) || null }
    } catch (e) {
        logger.error("getProductMetafieldsForL1 failed", e)
        return { metafieldsSummary: null }
    }
}
