import { prisma } from "@/lib/prisma"
import {
    buildCatalogSearchText,
    isProductStatusSellable,
    parseLinkedProductIdsFromMetafields,
    scoreByTerms,
    tokenizeSearchTerms,
} from "@/lib/ai/tools/productCatalog"

export type UpsellAllowedProduct = {
    shopifyProductId: string
    title: string
    sku: string | null
}

function firstSku(variants: unknown): string | null {
    try {
        const parsed = typeof variants === "string" ? JSON.parse(variants) : variants
        if (!Array.isArray(parsed) || parsed.length === 0) return null
        const value = parsed[0]?.sku
        const sku = value == null ? "" : String(value).trim()
        return sku || null
    } catch {
        return null
    }
}

function uniquePreserveOrder(values: string[]): string[] {
    const out: string[] = []
    const seen = new Set<string>()
    for (const value of values) {
        if (!value || seen.has(value)) continue
        seen.add(value)
        out.push(value)
    }
    return out
}

export async function getLinkedUpsellProducts(params: {
    storeId: string
    sourceProductIds: string[]
    query: string
    limit?: number
}): Promise<UpsellAllowedProduct[]> {
    const { storeId, sourceProductIds, query, limit = 6 } = params
    const sources = uniquePreserveOrder(sourceProductIds)
    if (!sources.length) return []

    const links = await prisma.upsellProductLink.findMany({
        where: {
            storeId,
            sourceShopifyProductId: { in: sources },
            isActive: true,
        },
        select: { targetShopifyProductId: true },
        take: 200,
    })

    const linkedFromDb = links.map((row) => row.targetShopifyProductId)

    const sourceProducts = await prisma.cachedProduct.findMany({
        where: {
            storeId,
            shopifyProductId: { in: sources },
        },
        select: {
            metafields: true,
        },
    })

    const linkedFromMetafields = sourceProducts.flatMap((p) =>
        parseLinkedProductIdsFromMetafields(p.metafields),
    )

    const targetIds = uniquePreserveOrder([...linkedFromDb, ...linkedFromMetafields]).slice(0, 200)
    if (!targetIds.length) return []

    const targetProducts = await prisma.cachedProduct.findMany({
        where: {
            storeId,
            shopifyProductId: { in: targetIds },
        },
        select: {
            shopifyProductId: true,
            title: true,
            status: true,
            variants: true,
            vendor: true,
            productType: true,
            metafields: true,
        },
    })

    const sellable = targetProducts.filter((p) => isProductStatusSellable(p.status))
    const terms = tokenizeSearchTerms(query, 8)
    if (terms.length === 0) {
        return sellable.slice(0, limit).map((p) => ({
            shopifyProductId: p.shopifyProductId,
            title: p.title,
            sku: firstSku(p.variants),
        }))
    }

    return sellable
        .map((p) => ({
            product: p,
            score: scoreByTerms(buildCatalogSearchText(p), terms),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(({ product }) => ({
            shopifyProductId: product.shopifyProductId,
            title: product.title,
            sku: firstSku(product.variants),
        }))
}
