import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { aiChatCompletion } from "@/lib/ai/chatCompletion"
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

type UpsellCatalogCandidate = {
    product: StorefrontActionProduct
    title: string
    productType: string | null
    details: string | null
}

const ACCEPTED_UPSELL_RELATIONSHIPS = new Set([
    "complementary_accessory",
    "care_item",
    "consumable",
    "bundle_addon",
    "used_together",
])

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

function compactMetafields(metafields: unknown): string | null {
    if (!Array.isArray(metafields)) return null
    const parts: string[] = []
    for (const row of metafields) {
        if (!row || typeof row !== "object" || Array.isArray(row)) continue
        const field = row as { key?: unknown; value?: unknown }
        const key = typeof field.key === "string" ? field.key.trim() : ""
        const value = typeof field.value === "string" ? field.value.trim() : ""
        if (key && value) parts.push(`${key}: ${value.slice(0, 120)}`)
    }
    return parts.length ? parts.join(" | ").slice(0, 500) : null
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
    const { baseProduct, candidates, limit = 20 } = params
    return candidates
        .filter((candidate) => candidate.shopifyProductId !== baseProduct.productId)
        .filter((candidate) => !candidate.status || candidate.status.toLowerCase() === "active")
        .map((candidate) => toUpsellActionProduct(candidate, params.query))
        .filter((product): product is StorefrontActionProduct => Boolean(product))
        .slice(0, limit)
}

function buildCatalogCandidate(product: CachedProductLike, query: string): UpsellCatalogCandidate | null {
    const actionProduct = toUpsellActionProduct(product, query)
    if (!actionProduct) return null
    return {
        product: actionProduct,
        title: product.title,
        productType: product.productType ?? null,
        details: compactMetafields(product.metafields),
    }
}

export function parseAiUpsellChoice(
    content: string | null,
    candidates: UpsellCatalogCandidate[],
): StorefrontActionProduct | null {
    if (!content) return null
    try {
        const parsed = JSON.parse(content) as {
            productId?: unknown
            relationshipType?: unknown
            confidence?: unknown
        }
        const productId = typeof parsed.productId === "string" ? parsed.productId.trim() : ""
        if (!productId) return null
        const relationshipType =
            typeof parsed.relationshipType === "string"
                ? parsed.relationshipType.trim().toLowerCase()
                : ""
        if (!ACCEPTED_UPSELL_RELATIONSHIPS.has(relationshipType)) return null
        const confidence = Number(parsed.confidence)
        if (!Number.isFinite(confidence) || confidence < 0.75) return null
        return candidates.find((candidate) => candidate.product.productId === productId)?.product ?? null
    } catch {
        return null
    }
}

async function selectAiUpsellCandidate(params: {
    baseProduct: StorefrontActionProduct
    query: string
    candidates: UpsellCatalogCandidate[]
}): Promise<StorefrontActionProduct | null> {
    if (params.candidates.length === 0) return null

    const system = [
        "You select one ecommerce upsell item, or no item.",
        "Use only the provided catalog candidates.",
        "Return JSON only: {\"productId\":\"...\"|null,\"relationshipType\":\"complementary_accessory|care_item|consumable|bundle_addon|used_together|substitute|alternative|same_category|unrelated|uncertain\",\"confidence\":0-1,\"reason\":\"...\"}.",
        "A valid upsell must be something the customer would reasonably buy in addition to the base product and use together with it.",
        "Choose only these valid relationship types: complementary_accessory, care_item, consumable, bundle_addon, used_together.",
        "Do not choose substitutes, alternatives, or same-category replacements, even if they share words, audience, color, brand, season, style, or price.",
        "Invalid examples: sandals -> flip flops, slippers -> shoes, rain boots -> formal shoes, one backpack -> another backpack.",
        "Valid examples: shoes -> socks, shoes -> laces, leather shoes -> polish, phone -> case, backpack -> lunch box.",
        "If there is no clear add-on with confidence at least 0.75, return productId null with relationshipType uncertain.",
    ].join(" ")

    const user = JSON.stringify({
        customerQuery: params.query,
        baseProduct: {
            title: params.baseProduct.title,
            productType: params.baseProduct.productType,
            sku: params.baseProduct.sku,
        },
        candidates: params.candidates.slice(0, 30).map((candidate) => ({
            productId: candidate.product.productId,
            title: candidate.title,
            productType: candidate.productType,
            details: candidate.details,
        })),
    })

    const { content, error } = await aiChatCompletion(
        [
            { role: "system", content: system },
            { role: "user", content: user },
        ],
        { jsonObject: true, temperature: 0.1, maxTokens: 220, timeoutMs: 10_000 },
    )

    if (!content) {
        logger.warn("selectAiUpsellCandidate: model call failed", { error })
        return null
    }

    return parseAiUpsellChoice(content, params.candidates)
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

    const candidates = products
        .filter((product) => product.shopifyProductId !== params.baseProduct.productId)
        .filter((product) => !product.status || product.status.toLowerCase() === "active")
        .map((product) => buildCatalogCandidate(product, params.query))
        .filter((candidate): candidate is UpsellCatalogCandidate => Boolean(candidate))
        .slice(0, 30)

    const selected = await selectAiUpsellCandidate({
        baseProduct: params.baseProduct,
        query: params.query,
        candidates,
    })

    return selected ? [selected].slice(0, params.limit ?? 1) : []
}
