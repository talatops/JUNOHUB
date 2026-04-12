import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import {
    sumVariantInventoryQuantity,
    supplierQuantityFromSyncedProductData,
} from "@/lib/products/shopifyInventorySum"
import { postB2bChatMessage } from "@/lib/chat/postB2bChatMessage"
import { notifyVendorShopifyLowStock } from "@/lib/notifications"
import {
    isLowStockRateLimited,
    logSupplierAutomation,
} from "@/lib/automation/supplierAutomationRate"
import { shouldSendLowStockSupplierMessage } from "@/lib/automation/lowStockNotifyGate"

const LOW_STOCK_MAX_PER_SUPPLIER_PER_DAY = 3

type ShopifyProductWebhookBody = {
    id?: unknown
    title?: unknown
    variants?: unknown
    images?: unknown
}

function shopifyProductIdString(body: ShopifyProductWebhookBody): string | null {
    const id = body.id
    if (id === undefined || id === null) return null
    return String(id)
}

function extractImageUrlFromImagesField(images: unknown): string | null {
    if (!Array.isArray(images) || images.length === 0) return null
    const first = images[0] as { src?: string; url?: string }
    return first?.src || first?.url || null
}

function buildLowStockTextContent(supplierQty: number): string {
    return `Supplier-reported quantity: ${supplierQty}. Please restock or share an ETA when you can.`
}

async function runShopifyLowStockVendorNotification(params: {
    storeId: string
    vendorUserId: string
    shopifyProductId: string
    title: string
    shopifyTotal: number
    threshold: number
}): Promise<void> {
    const { storeId, vendorUserId, shopifyProductId, title, shopifyTotal, threshold: shopifyTh } = params

    const state = await prisma.lowStockShopifyVendorAlertState.findUnique({
        where: {
            storeId_shopifyProductId: { storeId, shopifyProductId },
        },
    })

    const upsertAboveOrClear = async () => {
        await prisma.lowStockShopifyVendorAlertState.upsert({
            where: { storeId_shopifyProductId: { storeId, shopifyProductId } },
            create: {
                storeId,
                shopifyProductId,
                lastSeenShopifyTotal: shopifyTotal,
                lastNotifiedBelowAt: null,
            },
            update: {
                lastSeenShopifyTotal: shopifyTotal,
                lastNotifiedBelowAt: null,
            },
        })
    }

    if (shopifyTotal >= shopifyTh) {
        await upsertAboveOrClear()
        return
    }

    const prevQty = state?.lastSeenShopifyTotal ?? null
    if (
        !shouldSendLowStockSupplierMessage({
            newQty: shopifyTotal,
            threshold: shopifyTh,
            prevQty,
            lastNotifiedBelowAt: state?.lastNotifiedBelowAt ?? null,
        })
    ) {
        await prisma.lowStockShopifyVendorAlertState.upsert({
            where: { storeId_shopifyProductId: { storeId, shopifyProductId } },
            create: {
                storeId,
                shopifyProductId,
                lastSeenShopifyTotal: shopifyTotal,
                lastNotifiedBelowAt: null,
            },
            update: { lastSeenShopifyTotal: shopifyTotal },
        })
        return
    }

    try {
        await notifyVendorShopifyLowStock(vendorUserId, {
            storeId,
            shopifyProductId,
            productTitle: title,
            shopifyTotal,
            threshold: shopifyTh,
        })
    } catch (e) {
        logger.warn("[lowStock] notifyVendorShopifyLowStock failed", e)
        await prisma.lowStockShopifyVendorAlertState.upsert({
            where: { storeId_shopifyProductId: { storeId, shopifyProductId } },
            create: {
                storeId,
                shopifyProductId,
                lastSeenShopifyTotal: shopifyTotal,
                lastNotifiedBelowAt: null,
            },
            update: { lastSeenShopifyTotal: shopifyTotal },
        })
        return
    }

    const now = new Date()
    await prisma.lowStockShopifyVendorAlertState.upsert({
        where: { storeId_shopifyProductId: { storeId, shopifyProductId } },
        create: {
            storeId,
            shopifyProductId,
            lastSeenShopifyTotal: shopifyTotal,
            lastNotifiedBelowAt: now,
        },
        update: {
            lastSeenShopifyTotal: shopifyTotal,
            lastNotifiedBelowAt: now,
        },
    })
}

function buildProductChatAttachment(params: {
    storeId: string
    shopifyProductId: string
    title: string
    description: string | null
    imageUrl: string | null
}): {
    title: string
    description: string | null
    imageUrl: string | null
    storeName: null
    storeId: string
    productId: number
} {
    const productId = Number.parseInt(params.shopifyProductId, 10)
    return {
        title: params.title,
        description: params.description,
        imageUrl: params.imageUrl,
        storeName: null,
        storeId: params.storeId,
        productId: Number.isFinite(productId) ? productId : 0,
    }
}

/**
 * After Shopify product webhook updates cache (or during reconcile):
 * - If `lowStockShopifyThreshold` is set: compare total Shopify variant inventory to threshold; notify the vendor
 *   in-app when appropriate (deduped per product).
 * - If `lowStockThreshold` is set: for each ACCEPTED ProductSync, compare supplier-reported quantity; notify that
 *   supplier via a PRODUCT chat card (unchanged).
 */
export async function evaluateLowStockAfterProductWebhook(params: {
    storeId: string
    shopifyProductBody: ShopifyProductWebhookBody
}): Promise<void> {
    const shopifyProductId = shopifyProductIdString(params.shopifyProductBody)
    if (!shopifyProductId) return

    const store = await prisma.store.findUnique({
        where: { id: params.storeId },
        select: {
            lowStockThreshold: true,
            lowStockShopifyThreshold: true,
            userId: true,
        },
    })

    const supplierThreshold = store?.lowStockThreshold
    const shopifyThreshold = store?.lowStockShopifyThreshold
    if (store === null) {
        return
    }
    const hasSupplierRule = supplierThreshold !== null && supplierThreshold !== undefined
    const hasShopifyRule = shopifyThreshold !== null && shopifyThreshold !== undefined
    if (!hasSupplierRule && !hasShopifyRule) {
        return
    }

    const title =
        typeof params.shopifyProductBody.title === "string"
            ? params.shopifyProductBody.title
            : "Product"

    let imageUrl = extractImageUrlFromImagesField(params.shopifyProductBody.images)

    let cachedProductRow: { images: unknown; variants: unknown } | null = null
    const loadCachedProductRow = async (): Promise<{ images: unknown; variants: unknown } | null> => {
        if (cachedProductRow !== null) return cachedProductRow
        cachedProductRow = await prisma.cachedProduct.findUnique({
            where: {
                shopifyProductId_storeId: {
                    shopifyProductId,
                    storeId: params.storeId,
                },
            },
            select: { images: true, variants: true },
        })
        return cachedProductRow
    }

    if (imageUrl === null) {
        const row = await loadCachedProductRow()
        imageUrl = extractImageUrlFromImagesField(row?.images)
    }

    if (hasShopifyRule) {
        const shopifyTh = shopifyThreshold as number
        let shopifyTotal = sumVariantInventoryQuantity(params.shopifyProductBody.variants)
        if (shopifyTotal === null) {
            const row = await loadCachedProductRow()
            shopifyTotal = sumVariantInventoryQuantity(row?.variants)
        }
        if (shopifyTotal === null) {
            logger.info("[lowStock] skip Shopify vendor alert (no variant inventory totals)", {
                storeId: params.storeId,
                shopifyProductId,
            })
        } else {
            await runShopifyLowStockVendorNotification({
                storeId: params.storeId,
                vendorUserId: store.userId,
                shopifyProductId,
                title,
                shopifyTotal,
                threshold: shopifyTh,
            })
        }
    }

    if (!hasSupplierRule) {
        return
    }

    const threshold = supplierThreshold as number

    const syncs = await prisma.productSync.findMany({
        where: {
            storeId: params.storeId,
            shopifyProductId,
            status: "ACCEPTED",
        },
        include: {
            supplier: {
                select: { id: true, userId: true, companyName: true },
            },
        },
    })

    if (!syncs.length) {
        return
    }

    const vendorUserId = store.userId

    for (const sync of syncs) {
        const supplierQty = supplierQuantityFromSyncedProductData(sync.shopifyProductData)
        if (supplierQty === undefined) {
            logger.info("[lowStock] skip sync (no supplier quantity in snapshot)", {
                storeId: params.storeId,
                shopifyProductId,
                productSyncId: sync.id,
            })
            continue
        }

        const state = await prisma.lowStockAlertState.findUnique({
            where: {
                storeId_shopifyProductId_supplierId: {
                    storeId: params.storeId,
                    shopifyProductId,
                    supplierId: sync.supplierId,
                },
            },
        })

        const upsertAboveOrClear = async () => {
            await prisma.lowStockAlertState.upsert({
                where: {
                    storeId_shopifyProductId_supplierId: {
                        storeId: params.storeId,
                        shopifyProductId,
                        supplierId: sync.supplierId,
                    },
                },
                create: {
                    storeId: params.storeId,
                    shopifyProductId,
                    supplierId: sync.supplierId,
                    lastSeenSupplierQty: supplierQty,
                    lastNotifiedBelowAt: null,
                },
                update: {
                    lastSeenSupplierQty: supplierQty,
                    lastNotifiedBelowAt: null,
                },
            })
        }

        if (supplierQty >= threshold) {
            await upsertAboveOrClear()
            continue
        }

        const prevQty = state?.lastSeenSupplierQty ?? null
        if (
            !shouldSendLowStockSupplierMessage({
                newQty: supplierQty,
                threshold,
                prevQty,
                lastNotifiedBelowAt: state?.lastNotifiedBelowAt ?? null,
            })
        ) {
            await prisma.lowStockAlertState.upsert({
                where: {
                    storeId_shopifyProductId_supplierId: {
                        storeId: params.storeId,
                        shopifyProductId,
                        supplierId: sync.supplierId,
                    },
                },
                create: {
                    storeId: params.storeId,
                    shopifyProductId,
                    supplierId: sync.supplierId,
                    lastSeenSupplierQty: supplierQty,
                    lastNotifiedBelowAt: null,
                },
                update: { lastSeenSupplierQty: supplierQty },
            })
            continue
        }

        const supplierUserId = sync.supplier.userId
        const limited = await isLowStockRateLimited(
            params.storeId,
            shopifyProductId,
            supplierUserId,
            LOW_STOCK_MAX_PER_SUPPLIER_PER_DAY,
        )
        if (limited) {
            logger.warn("[lowStock] rate limited", {
                storeId: params.storeId,
                shopifyProductId,
                supplierUserId,
            })
            continue
        }

        const content = buildLowStockTextContent(supplierQty)
        const attachment = buildProductChatAttachment({
            storeId: params.storeId,
            shopifyProductId,
            title: sync.shopifyProductTitle || title,
            description: null,
            imageUrl,
        })

        const posted = await postB2bChatMessage({
            senderId: vendorUserId,
            receiverId: supplierUserId,
            storeId: params.storeId,
            kind: "PRODUCT",
            content,
            attachment,
            notify: true,
        })

        const now = new Date()
        if (!posted.ok) {
            logger.warn("[lowStock] chat post failed", {
                storeId: params.storeId,
                shopifyProductId,
                supplierUserId,
                reason: posted.reason,
            })
            await prisma.lowStockAlertState.upsert({
                where: {
                    storeId_shopifyProductId_supplierId: {
                        storeId: params.storeId,
                        shopifyProductId,
                        supplierId: sync.supplierId,
                    },
                },
                create: {
                    storeId: params.storeId,
                    shopifyProductId,
                    supplierId: sync.supplierId,
                    lastSeenSupplierQty: supplierQty,
                    lastNotifiedBelowAt: null,
                },
                update: { lastSeenSupplierQty: supplierQty },
            })
            continue
        }

        await logSupplierAutomation({
            storeId: params.storeId,
            kind: "LOW_STOCK",
            shopifyProductId,
            supplierUserId,
            messagePreview: content.slice(0, 500),
        })

        await prisma.lowStockAlertState.upsert({
            where: {
                storeId_shopifyProductId_supplierId: {
                    storeId: params.storeId,
                    shopifyProductId,
                    supplierId: sync.supplierId,
                },
            },
            create: {
                storeId: params.storeId,
                shopifyProductId,
                supplierId: sync.supplierId,
                lastSeenSupplierQty: supplierQty,
                lastNotifiedBelowAt: now,
            },
            update: {
                lastSeenSupplierQty: supplierQty,
                lastNotifiedBelowAt: now,
            },
        })
    }
}

/**
 * Reconcile cached ACCEPTED-synced products for one store (missed webhooks / after threshold save).
 * Bounded work per invocation.
 */
export async function reconcileLowStockForStore(
    storeId: string,
    maxProductsPerStore = 120,
): Promise<void> {
    const store = await prisma.store.findUnique({
        where: { id: storeId },
        select: {
            id: true,
            lowStockThreshold: true,
            lowStockShopifyThreshold: true,
        },
    })
    if (
        !store ||
        (store.lowStockThreshold === null && store.lowStockShopifyThreshold === null)
    ) {
        return
    }

    const syncRows = await prisma.productSync.findMany({
        where: {
            storeId: store.id,
            status: "ACCEPTED",
        },
        select: { shopifyProductId: true },
        take: maxProductsPerStore * 3,
    })
    const seen = new Set<string>()
    const syncedIds: { shopifyProductId: string }[] = []
    for (const r of syncRows) {
        if (seen.has(r.shopifyProductId)) continue
        seen.add(r.shopifyProductId)
        syncedIds.push({ shopifyProductId: r.shopifyProductId })
        if (syncedIds.length >= maxProductsPerStore) break
    }

    for (const row of syncedIds) {
        const cached = await prisma.cachedProduct.findUnique({
            where: {
                shopifyProductId_storeId: {
                    shopifyProductId: row.shopifyProductId,
                    storeId: store.id,
                },
            },
        })
        if (!cached) continue

        const body: ShopifyProductWebhookBody = {
            id: row.shopifyProductId,
            title: cached.title,
            variants: cached.variants as unknown,
            images: cached.images as unknown,
        }
        await evaluateLowStockAfterProductWebhook({
            storeId: store.id,
            shopifyProductBody: body,
        })
    }
}

/**
 * Reconcile cached products for stores with low-stock automation enabled (missed webhooks).
 * Bounded work per invocation.
 */
export async function reconcileLowStockForActiveStores(maxStores = 10, maxProductsPerStore = 80) {
    const stores = await prisma.store.findMany({
        where: {
            isActive: true,
            OR: [
                { lowStockThreshold: { not: null } },
                { lowStockShopifyThreshold: { not: null } },
            ],
        },
        select: {
            id: true,
        },
        take: maxStores,
    })

    for (const store of stores) {
        await reconcileLowStockForStore(store.id, maxProductsPerStore)
    }
}
