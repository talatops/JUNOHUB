import { prisma } from "@/lib/prisma"
import type { SupplierAutomationKind } from "@prisma/client"

const DAY_MS = 86_400_000
const HOUR_MS = 3_600_000

export async function countLowStockLogsSince(
    storeId: string,
    shopifyProductId: string,
    supplierUserId: string,
    since: Date,
): Promise<number> {
    return prisma.supplierAutomationLog.count({
        where: {
            storeId,
            kind: "LOW_STOCK",
            shopifyProductId,
            supplierUserId,
            createdAt: { gte: since },
        },
    })
}

export async function countAskSupplierLogsForTicketSince(
    storeId: string,
    ticketKey: string,
    since: Date,
): Promise<number> {
    return prisma.supplierAutomationLog.count({
        where: {
            storeId,
            kind: "ASK_SUPPLIER",
            ticketKey,
            createdAt: { gte: since },
        },
    })
}

/** Max low-stock chat messages per product+supplier per rolling 24h. */
export async function isLowStockRateLimited(
    storeId: string,
    shopifyProductId: string,
    supplierUserId: string,
    maxPerDay: number,
): Promise<boolean> {
    const since = new Date(Date.now() - DAY_MS)
    const n = await countLowStockLogsSince(storeId, shopifyProductId, supplierUserId, since)
    return n >= maxPerDay
}

/** Max ask-supplier sends per ticket per hour. */
export async function isAskSupplierTicketRateLimited(
    storeId: string,
    ticketKey: string,
    maxPerHour: number,
): Promise<boolean> {
    const since = new Date(Date.now() - HOUR_MS)
    const n = await countAskSupplierLogsForTicketSince(storeId, ticketKey, since)
    return n >= maxPerHour
}

export async function logSupplierAutomation(params: {
    storeId: string
    kind: SupplierAutomationKind
    shopifyProductId?: string | null
    supplierUserId?: string | null
    ticketKey?: string | null
    messagePreview: string
}): Promise<void> {
    const preview = params.messagePreview.replace(/\0/g, "").slice(0, 2000)
    await prisma.supplierAutomationLog.create({
        data: {
            storeId: params.storeId,
            kind: params.kind,
            shopifyProductId: params.shopifyProductId ?? null,
            supplierUserId: params.supplierUserId ?? null,
            ticketKey: params.ticketKey ?? null,
            messagePreview: preview,
        },
    })
}
