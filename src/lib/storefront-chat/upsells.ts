import { prisma } from "@/lib/prisma"
import type { StorefrontActionProduct } from "@/lib/storefront-chat/actions"
import { extractCartableVariants, selectVariantForCart } from "@/lib/storefront-chat/cartLinks"

type CachedProductLike = {
    shopifyProductId: string
    title: string
    productType?: string | null
    status?: string | null
    variants?: unknown
    images?: unknown
    metafields?: unknown
}

const STOPWORDS = new Set([
    "the",
    "and",
    "for",
    "with",
    "that",
    "this",
    "want",
    "need",
    "product",
    "item",
    "buy",
    "cart",
    "add",
])

const ACCESSORY_PAIRS: Array<{ base: RegExp; accessory: RegExp; score: number }> = [
    { base: /\bshoe|shoes|sneaker|sneakers|boot|boots\b/i, accessory: /\bsock|socks|laces?|insole|insoles\b/i, score: 8 },
    { base: /\bshirt|uniform|dress\b/i, accessory: /\btie|belt|cap|scarf\b/i, score: 5 },
    { base: /\bbag|backpack\b/i, accessory: /\bbottle|lunch|pouch|case\b/i, score: 5 },
    { base: /\bphone|mobile\b/i, accessory: /\bcase|cover|charger|cable\b/i, score: 6 },
]

function tokenize(text: string) {
    return text
        .toLowerCase()
        .split(/[^a-z0-9]+/g)
        .map((token) => token.trim())
        .filter((token) => token.length >= 2 && !STOPWORDS.has(token))
}

function uniqueTokens(...texts: Array<string | null | undefined>) {
    return Array.from(new Set(texts.flatMap((text) => tokenize(text ?? ""))))
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

function productText(product: CachedProductLike) {
    return [
        product.title,
        product.productType,
        JSON.stringify(product.metafields ?? ""),
    ]
        .filter(Boolean)
        .join(" ")
}

function accessoryScore(baseText: string, candidateText: string) {
    let score = 0
    for (const pair of ACCESSORY_PAIRS) {
        if (pair.base.test(baseText) && pair.accessory.test(candidateText)) {
            score += pair.score
        }
    }
    return score
}

function toUpsellActionProduct(product: CachedProductLike, query: string): StorefrontActionProduct | null {
    const variants = extractCartableVariants(product.variants)
    const selected = selectVariantForCart({ variants, message: query })
    if (selected.status !== "selected") return null

    return {
        productId: product.shopifyProductId,
        title: product.title,
        variantId: selected.variant.id,
        variantTitle: selected.variant.title,
        sku: selected.variant.sku,
        price: selected.variant.price,
        imageUrl: imageUrlFromImages(product.images),
        productType: product.productType ?? null,
        quantity: 1,
    }
}

export function rankAutomaticUpsellCandidates(params: {
    baseProduct: StorefrontActionProduct
    query: string
    candidates: CachedProductLike[]
    limit?: number
}): StorefrontActionProduct[] {
    const { baseProduct, query, candidates, limit = 1 } = params
    const baseText = [baseProduct.title, baseProduct.productType, query].filter(Boolean).join(" ")
    const baseTokens = new Set(uniqueTokens(baseText))

    const ranked = candidates
        .filter((candidate) => candidate.shopifyProductId !== baseProduct.productId)
        .filter((candidate) => !candidate.status || candidate.status.toLowerCase() === "active")
        .map((candidate) => {
            const candidateText = productText(candidate)
            const candidateTokens = uniqueTokens(candidateText)
            let score = accessoryScore(baseText, candidateText)
            for (const token of candidateTokens) {
                if (baseTokens.has(token)) score += 2
            }
            if (candidate.productType && baseProduct.productType && candidate.productType !== baseProduct.productType) {
                score += 1
            }
            const product = toUpsellActionProduct(candidate, query)
            return { product, score }
        })
        .filter((row): row is { product: StorefrontActionProduct; score: number } => Boolean(row.product) && row.score > 0)
        .sort((a, b) => b.score - a.score)

    return ranked.slice(0, limit).map((row) => row.product)
}

export async function findAutomaticUpsellCandidates(params: {
    storeId: string
    baseProduct: StorefrontActionProduct
    query: string
    limit?: number
}): Promise<StorefrontActionProduct[]> {
    const products = await prisma.cachedProduct.findMany({
        where: { storeId: params.storeId },
        orderBy: { updatedAt: "desc" },
        take: 300,
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

    return rankAutomaticUpsellCandidates({
        baseProduct: params.baseProduct,
        query: params.query,
        candidates: products,
        limit: params.limit,
    })
}
