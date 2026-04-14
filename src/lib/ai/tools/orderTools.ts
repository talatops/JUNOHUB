import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import {
    extractOrderNumberHints,
    normalizeOrderNumberKey,
} from "@/lib/ai/gmailContext"

export type OrderListCandidate = {
    shopifyOrderId: string
    orderNumber: string
    shopifyCreatedAt: string | null
    financialStatus: string | null
    fulfillmentStatus: string | null
    totalPrice: string
    currency: string | null
}

function normalizeEmail(email: string): string {
    return email.trim().toLowerCase()
}

/**
 * Orders for a customer email from CachedOrder (same matching rules as Gmail context).
 */
export async function listOrdersForCustomerEmail(
    storeId: string,
    customerEmail: string,
    limit = 50,
): Promise<OrderListCandidate[]> {
    const normalized = normalizeEmail(customerEmail)
    if (!normalized) return []

    try {
        const rows = await prisma.$queryRaw<
            {
                shopifyOrderId: string
                orderNumber: string
                shopifyCreatedAt: Date | null
                financialStatus: string | null
                fulfillmentStatus: string | null
                totalPrice: string
                currency: string | null
            }[]
        >`
            SELECT
                "shopifyOrderId",
                "orderNumber",
                "shopifyCreatedAt",
                "financialStatus",
                "fulfillmentStatus",
                "totalPrice",
                currency
            FROM "CachedOrder"
            WHERE "storeId" = ${storeId}
              AND (
                LOWER(TRIM(COALESCE(email, ''))) = ${normalized}
                OR LOWER(TRIM(COALESCE(customer->>'email', ''))) = ${normalized}
              )
            ORDER BY "shopifyCreatedAt" DESC NULLS LAST, "createdAt" DESC
            LIMIT ${limit}
        `
        return rows.map((r) => ({
            shopifyOrderId: r.shopifyOrderId,
            orderNumber: r.orderNumber,
            shopifyCreatedAt: r.shopifyCreatedAt?.toISOString() ?? null,
            financialStatus: r.financialStatus,
            fulfillmentStatus: r.fulfillmentStatus,
            totalPrice: r.totalPrice,
            currency: r.currency,
        }))
    } catch (e) {
        logger.error("listOrdersForCustomerEmail failed", e)
        return []
    }
}

export type OrderDetailRow = {
    shopifyOrderId: string
    orderNumber: string
    email: string | null
    totalPrice: string
    currency: string | null
    financialStatus: string | null
    fulfillmentStatus: string | null
    holdReasonCode: string | null
    trackingNumber: string | null
    trackingCompany: string | null
    trackingUrl: string | null
    lineItems: unknown
    shopifyCreatedAt: Date | string | null
}

/**
 * Full order row when email matches the order (fiber rule).
 */
export async function getOrderDetailForVerifiedEmail(
    storeId: string,
    customerEmail: string,
    opts: { shopifyOrderId?: string; orderNumberHint?: string },
): Promise<OrderDetailRow | null> {
    const normalized = normalizeEmail(customerEmail)
    if (!normalized) return null

    const candidates = await listOrdersForCustomerEmail(storeId, customerEmail, 80)
    if (candidates.length === 0) return null

    let match: OrderListCandidate | undefined

    if (opts.shopifyOrderId?.trim()) {
        match = candidates.find((c) => c.shopifyOrderId === opts.shopifyOrderId!.trim())
    } else if (opts.orderNumberHint?.trim()) {
        const key = normalizeOrderNumberKey(opts.orderNumberHint.trim())
        match = candidates.find(
            (c) => normalizeOrderNumberKey(c.orderNumber) === key,
        )
    } else if (candidates.length === 1) {
        match = candidates[0]
    } else {
        return null
    }

    if (!match) return null

    try {
        const rows = await prisma.$queryRaw<OrderDetailRow[]>`
            SELECT
                "shopifyOrderId",
                "orderNumber",
                email,
                "totalPrice",
                currency,
                "financialStatus",
                "fulfillmentStatus",
                "holdReasonCode",
                "trackingNumber",
                "trackingCompany",
                "trackingUrl",
                "lineItems",
                "shopifyCreatedAt"
            FROM "CachedOrder"
            WHERE "storeId" = ${storeId}
              AND "shopifyOrderId" = ${match.shopifyOrderId}
              AND (
                LOWER(TRIM(COALESCE(email, ''))) = ${normalized}
                OR LOWER(TRIM(COALESCE(customer->>'email', ''))) = ${normalized}
              )
            LIMIT 1
        `
        const row = rows[0]
        if (!row) return null
        const sc = row.shopifyCreatedAt
        const created =
            sc instanceof Date
                ? sc.toISOString()
                : sc
                  ? new Date(sc).toISOString()
                  : null
        return {
            ...row,
            shopifyCreatedAt: created,
        }
    } catch (e) {
        logger.error("getOrderDetailForVerifiedEmail failed", e)
        return null
    }
}

export function orderNeedsDisambiguation(
    customerEmail: string,
    hintText: string | undefined,
    candidates: OrderListCandidate[],
): boolean {
    if (candidates.length <= 1) return false
    const hints = hintText ? extractOrderNumberHints(hintText) : []
    if (hints.length > 0) {
        const matched = candidates.filter((c) =>
            hints.some((h) => normalizeOrderNumberKey(h) === normalizeOrderNumberKey(c.orderNumber)),
        )
        return matched.length !== 1
    }
    return true
}

export function formatOrderCandidatesForPrompt(candidates: OrderListCandidate[]): string {
    return candidates
        .slice(0, 8)
        .map(
            (c, i) =>
                `${i + 1}. Order ${c.orderNumber} (placed ${c.shopifyCreatedAt?.slice(0, 10) ?? "unknown"}) — ${c.financialStatus ?? "?"} / ${c.fulfillmentStatus ?? "?"}`,
        )
        .join("\n")
}
