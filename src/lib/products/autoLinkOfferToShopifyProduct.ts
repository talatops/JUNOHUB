/**
 * Auto-links a Shopify product to a supplier when exactly one SupplierProductOffer
 * matches (title first, SKU to disambiguate or SKU-only fallback).
 *
 * Skips entirely if any ProductSync already exists for this store + shopifyProductId
 * (any status, any supplier) so manual / pending / rejected flows are not overridden.
 * Vendors with a rejected sync must use manual sync after the supplier rejects.
 */

import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import type { Prisma } from "@prisma/client"
import { sumVariantInventoryQuantity } from "@/lib/products/shopifyInventorySum"

export type SupplierOfferForMatching = {
    supplierId: string
    /** Offer quantity (items available from supplier for this store). */
    offerQuantity: number
    product: { title: string; sku: string | null }
}

export type SupplierOfferQuantityRow = {
    supplierId: string
    quantity: number
    product: { title: string; sku: string | null }
}

export function normalizeProductTitle(title: string): string {
    return title
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ")
}

export function extractVariantSkusFromShopifyBody(body: unknown): Set<string> {
    const out = new Set<string>()
    if (!body || typeof body !== "object") return out
    const variants = (body as { variants?: unknown }).variants
    if (!Array.isArray(variants)) return out
    for (const v of variants) {
        if (v && typeof v === "object" && "sku" in v) {
            const sku = String((v as { sku?: unknown }).sku ?? "").trim()
            if (sku) out.add(sku)
        }
    }
    return out
}

function shopifyTitleFromBody(body: unknown): string {
    if (!body || typeof body !== "object") return ""
    const t = (body as { title?: unknown }).title
    return typeof t === "string" ? t : ""
}

function shopifyProductIdFromBody(body: unknown): string | null {
    if (!body || typeof body !== "object") return null
    const id = (body as { id?: unknown }).id
    if (id === undefined || id === null) return null
    return String(id)
}

/**
 * Pick at most one offer using: normalized title match; if multiple, narrow by variant SKU;
 * if no title match, unique SKU match across variants.
 */
export function pickMatchingSupplierOffer(
    offers: SupplierOfferForMatching[],
    shopifyTitle: string,
    variantSkus: Set<string>,
): SupplierOfferForMatching | null {
    if (!offers.length) return null

    const normShop = normalizeProductTitle(shopifyTitle)
    if (!normShop) {
        // No title — only SKU-only path
        return pickUniqueSkuMatch(offers, variantSkus)
    }

    const titleMatches = offers.filter(
        (o) => normalizeProductTitle(o.product.title) === normShop,
    )

    if (titleMatches.length === 1) {
        return titleMatches[0]!
    }

    if (titleMatches.length > 1) {
        const narrowed = filterOffersBySkuInSet(titleMatches, variantSkus)
        return narrowed.length === 1 ? narrowed[0]! : null
    }

    return pickUniqueSkuMatch(offers, variantSkus)
}

function filterOffersBySkuInSet(
    offers: SupplierOfferForMatching[],
    variantSkus: Set<string>,
): SupplierOfferForMatching[] {
    return offers.filter((o) => {
        const s = (o.product.sku ?? "").trim()
        return Boolean(s) && variantSkus.has(s)
    })
}

function pickUniqueSkuMatch(
    offers: SupplierOfferForMatching[],
    variantSkus: Set<string>,
): SupplierOfferForMatching | null {
    if (variantSkus.size === 0) return null
    const matches = filterOffersBySkuInSet(offers, variantSkus)
    return matches.length === 1 ? matches[0]! : null
}

/**
 * When ProductSync JSON lacks supplier_quantity, infer it from the matching
 * SupplierProductOffer (same title/SKU rules as auto-link).
 */
export function resolveSupplierQuantityFromOffers(
    shopifyTitle: string,
    shopifyProductData: unknown,
    offers: SupplierOfferQuantityRow[],
): number | undefined {
    if (!offers.length) return undefined
    const variantSkus = extractVariantSkusFromShopifyBody(shopifyProductData)
    const mapped: SupplierOfferForMatching[] = offers.map((o) => ({
        supplierId: o.supplierId,
        offerQuantity: o.quantity,
        product: o.product,
    }))
    const winner = pickMatchingSupplierOffer(mapped, shopifyTitle, variantSkus)
    return winner?.offerQuantity
}

function mergeShopifyBodyWithSupplierQuantity(
    body: unknown,
    supplierQuantity: number,
): Prisma.InputJsonValue {
    const base =
        body && typeof body === "object" && !Array.isArray(body)
            ? { ...(body as Record<string, unknown>) }
            : {}
    return { ...base, supplier_quantity: supplierQuantity } as Prisma.InputJsonValue
}

function autoLinkEnabledFromEnv(): boolean {
    const v = process.env.AUTO_LINK_SUPPLIER_OFFERS?.trim().toLowerCase()
    if (v === "0" || v === "false" || v === "off" || v === "no") {
        return false
    }
    return true
}

export type AutoLinkOfferResult =
    | { linked: true; productSyncId: string; supplierId: string }
    | {
          linked: false
          reason:
              | "disabled"
              | "invalid_payload"
              | "existing_sync"
              | "no_store_user"
              | "no_offers"
              | "no_match"
              | "create_failed"
      }

/**
 * After Shopify products/create or products/update webhook body is verified and cache updated.
 */
export async function autoLinkOfferToShopifyProduct(
    storeId: string,
    shopifyProductBody: unknown,
): Promise<AutoLinkOfferResult> {
    if (!autoLinkEnabledFromEnv()) {
        return { linked: false, reason: "disabled" }
    }

    const shopifyProductId = shopifyProductIdFromBody(shopifyProductBody)
    if (!shopifyProductId) {
        return { linked: false, reason: "invalid_payload" }
    }

    const existingCount = await prisma.productSync.count({
        where: {
            storeId,
            shopifyProductId,
        },
    })

    if (existingCount > 0) {
        return { linked: false, reason: "existing_sync" }
    }

    const store = await prisma.store.findUnique({
        where: { id: storeId },
        select: { userId: true },
    })

    if (!store?.userId) {
        return { linked: false, reason: "no_store_user" }
    }

    if (!("supplierProductOffer" in prisma)) {
        logger.warn("[autoLinkOffer] Prisma client missing supplierProductOffer model")
        return { linked: false, reason: "no_offers" }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawOffers = await (prisma as any).supplierProductOffer.findMany({
        where: { storeId },
        include: {
            product: {
                select: {
                    title: true,
                    sku: true,
                },
            },
            connection: {
                select: {
                    status: true,
                },
            },
        },
    }) as Array<{
        supplierId: string
        quantity: number
        product: { title: string; sku: string | null }
        connection: { status: string }
    }>

    const offers: SupplierOfferForMatching[] = rawOffers
        .filter((o) => o.connection.status === "CONNECTED")
        .map((o) => ({
            supplierId: o.supplierId,
            offerQuantity: o.quantity,
            product: o.product,
        }))

    if (!offers.length) {
        return { linked: false, reason: "no_offers" }
    }

    const shopifyTitle = shopifyTitleFromBody(shopifyProductBody)
    const variantSkus = extractVariantSkusFromShopifyBody(shopifyProductBody)
    const winner = pickMatchingSupplierOffer(offers, shopifyTitle, variantSkus)

    if (!winner) {
        logger.info("[autoLinkOffer] No unambiguous supplier offer match", {
            storeId,
            shopifyProductId,
            titleSample: shopifyTitle.slice(0, 80),
            variantSkuCount: variantSkus.size,
            connectedOfferCount: offers.length,
        })
        return { linked: false, reason: "no_match" }
    }

    const variants =
        shopifyProductBody && typeof shopifyProductBody === "object"
            ? (shopifyProductBody as { variants?: unknown }).variants
            : undefined
    const shopifyStockSum = sumVariantInventoryQuantity(variants)
    const initialSupplierQty =
        shopifyStockSum !== null ? shopifyStockSum : winner.offerQuantity

    const shopifyProductData = mergeShopifyBodyWithSupplierQuantity(
        shopifyProductBody,
        initialSupplierQty,
    )

    try {
        const row = await prisma.productSync.create({
            data: {
                storeId,
                supplierId: winner.supplierId,
                shopifyProductId,
                shopifyProductTitle: shopifyTitle || `Product ${shopifyProductId}`,
                shopifyProductData,
                status: "ACCEPTED",
                requestedBy: store.userId,
                acceptedAt: new Date(),
            },
        })

        logger.info("[autoLinkOffer] Created ACCEPTED ProductSync from webhook", {
            storeId,
            shopifyProductId,
            supplierId: winner.supplierId,
            productSyncId: row.id,
        })

        return {
            linked: true,
            productSyncId: row.id,
            supplierId: winner.supplierId,
        }
    } catch (e) {
        logger.error("[autoLinkOffer] Failed to create ProductSync", {
            storeId,
            shopifyProductId,
            error: e instanceof Error ? e.message : String(e),
        })
        return { linked: false, reason: "create_failed" }
    }
}
