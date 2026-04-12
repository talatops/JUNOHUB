import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { sumVariantInventoryQuantity } from "@/lib/products/shopifyInventorySum"
import { postB2bChatMessage } from "@/lib/chat/postB2bChatMessage"
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
}

function shopifyProductIdString(body: ShopifyProductWebhookBody): string | null {
    const id = body.id
    if (id === undefined || id === null) return null
    return String(id)
}

function buildLowStockMessage(params: {
    storeName: string
    productTitle: string
    shopifyProductId: string
    currentQty: number
    threshold: number
    shopifyDomain: string
}): string {
    const domain = params.shopifyDomain
        .trim()
        .replace(/^https?:\/\//, "")
        .replace(/\/$/, "")
    const adminUrl = `https://${domain}/admin/products/${params.shopifyProductId}`
    return [
        `[Low stock — automated]`,
        `Store: ${params.storeName}`,
        `Product: ${params.productTitle}`,
        `Shopify product ID: ${params.shopifyProductId}`,
        `Total inventory (sum of variants): ${params.currentQty}`,
        `Store threshold: ${params.threshold}`,
        `Please confirm restock or ETA when you can.`,
        `Admin: ${adminUrl}`,
    ].join("\n")
}

/**
 * After Shopify product webhook updates cache: evaluate low-stock and notify linked supplier(s).
 * @param prevTotalQty - total from CachedProduct variants before this update; null if no prior row
 */
export async function evaluateLowStockAfterProductWebhook(params: {
    storeId: string
    shopifyProductBody: ShopifyProductWebhookBody
    prevTotalQty: number | null
}): Promise<void> {
    const shopifyProductId = shopifyProductIdString(params.shopifyProductBody)
    if (!shopifyProductId) return

    const store = await prisma.store.findUnique({
        where: { id: params.storeId },
        select: {
            lowStockThreshold: true,
            userId: true,
            businessName: true,
            shopifyDomain: true,
        },
    })

    const threshold = store?.lowStockThreshold
    if (store === null || threshold === null || threshold === undefined) {
        return
    }

    const variants = params.shopifyProductBody.variants
    const newQty = sumVariantInventoryQuantity(variants)
    if (newQty === null) {
        return
    }

    const title =
        typeof params.shopifyProductBody.title === "string"
            ? params.shopifyProductBody.title
            : "Product"

    const state = await prisma.lowStockAlertState.findUnique({
        where: {
            storeId_shopifyProductId: {
                storeId: params.storeId,
                shopifyProductId,
            },
        },
    })

    if (newQty >= threshold) {
        await prisma.lowStockAlertState.upsert({
            where: {
                storeId_shopifyProductId: {
                    storeId: params.storeId,
                    shopifyProductId,
                },
            },
            create: {
                storeId: params.storeId,
                shopifyProductId,
                lastSeenTotalQty: newQty,
                lastNotifiedBelowAt: null,
            },
            update: {
                lastSeenTotalQty: newQty,
                lastNotifiedBelowAt: null,
            },
        })
        return
    }

    // Below threshold
    const prevQty = params.prevTotalQty
    if (
        !shouldSendLowStockSupplierMessage({
            newQty,
            threshold,
            prevQty,
            lastNotifiedBelowAt: state?.lastNotifiedBelowAt ?? null,
        })
    ) {
        await prisma.lowStockAlertState.update({
            where: {
                storeId_shopifyProductId: {
                    storeId: params.storeId,
                    shopifyProductId,
                },
            },
            data: { lastSeenTotalQty: newQty },
        })
        return
    }

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
        logger.info("[lowStock] no ACCEPTED ProductSync for product", {
            storeId: params.storeId,
            shopifyProductId,
        })
        await prisma.lowStockAlertState.upsert({
            where: {
                storeId_shopifyProductId: {
                    storeId: params.storeId,
                    shopifyProductId,
                },
            },
            create: {
                storeId: params.storeId,
                shopifyProductId,
                lastSeenTotalQty: newQty,
                lastNotifiedBelowAt: null,
            },
            update: { lastSeenTotalQty: newQty },
        })
        return
    }

    const vendorUserId = store.userId
    const now = new Date()
    let anySent = false

    for (const sync of syncs) {
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

        const content = buildLowStockMessage({
            storeName: store.businessName,
            productTitle: title,
            shopifyProductId,
            currentQty: newQty,
            threshold,
            shopifyDomain: store.shopifyDomain,
        })

        const posted = await postB2bChatMessage({
            senderId: vendorUserId,
            receiverId: supplierUserId,
            storeId: params.storeId,
            kind: "TEXT",
            content,
            notify: true,
        })

        if (!posted.ok) {
            logger.warn("[lowStock] chat post failed", {
                storeId: params.storeId,
                shopifyProductId,
                supplierUserId,
                reason: posted.reason,
            })
            continue
        }

        anySent = true
        await logSupplierAutomation({
            storeId: params.storeId,
            kind: "LOW_STOCK",
            shopifyProductId,
            supplierUserId,
            messagePreview: content.slice(0, 500),
        })
    }

    await prisma.lowStockAlertState.upsert({
        where: {
            storeId_shopifyProductId: {
                storeId: params.storeId,
                shopifyProductId,
            },
        },
        create: {
            storeId: params.storeId,
            shopifyProductId,
            lastSeenTotalQty: newQty,
            lastNotifiedBelowAt: anySent ? now : null,
        },
        update: {
            lastSeenTotalQty: newQty,
            ...(anySent ? { lastNotifiedBelowAt: now } : {}),
        },
    })
}

/**
 * Reconcile cached products for stores with low-stock automation enabled (missed webhooks).
 * Bounded work per invocation.
 */
export async function reconcileLowStockForActiveStores(maxStores = 10, maxProductsPerStore = 80) {
    const stores = await prisma.store.findMany({
        where: {
            isActive: true,
            lowStockThreshold: { not: null },
        },
        select: {
            id: true,
            lowStockThreshold: true,
            userId: true,
            businessName: true,
            shopifyDomain: true,
        },
        take: maxStores,
    })

    for (const store of stores) {
        const threshold = store.lowStockThreshold
        if (threshold === null) continue

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

            const alertState = await prisma.lowStockAlertState.findUnique({
                where: {
                    storeId_shopifyProductId: {
                        storeId: store.id,
                        shopifyProductId: row.shopifyProductId,
                    },
                },
            })
            const prevForReconcile = alertState?.lastSeenTotalQty ?? null

            const body: ShopifyProductWebhookBody = {
                id: row.shopifyProductId,
                title: cached.title,
                variants: cached.variants as unknown,
            }
            await evaluateLowStockAfterProductWebhook({
                storeId: store.id,
                shopifyProductBody: body,
                prevTotalQty: prevForReconcile,
            })
        }
    }
}
