import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"

type ShopifyLineItem = { name?: string; title?: string; quantity?: number; product_id?: number }

type CachedOrderSummaryRow = {
    orderNumber: string
    shopifyOrderId: string
    totalPrice: string
    currency: string | null
    financialStatus: string | null
    fulfillmentStatus: string | null
    shopifyCreatedAt: Date | null
    createdAt: Date
    lineItems: unknown
}

/** Strip Shopify-style # prefix for comparison. */
export function normalizeOrderNumberKey(orderNumber: string): string {
    return orderNumber.replace(/^\s*#?\s*/i, "").trim()
}

/**
 * Pull likely order numbers from subject + body (e.g. "order id is 1002", "#1002").
 */
export function extractOrderNumberHints(text: string): string[] {
    const out = new Set<string>()
    const patterns: RegExp[] = [
        /\bmy\s+order\s+is\s+(\d{3,})\b/gi,
        /\border\s+is\s+(\d{3,})\b/gi,
        /\border\s+id\s+is\s+(\d{3,})\b/gi,
        /\border\s+number\s+is\s+(\d{3,})\b/gi,
        /\bmy\s+order\s+id\s+is\s+(\d{3,})\b/gi,
        /\border\s*(?:id|number|no\.?)\s*[:#]?\s*#?(\d{3,})\b/gi,
        /\border\s*#\s*(\d{3,})\b/gi,
        /\border\s+(\d{3,})\b/gi,
        /#(\d{3,})\b/g,
    ]
    for (const re of patterns) {
        let m: RegExpExecArray | null
        const r = new RegExp(re.source, re.flags)
        while ((m = r.exec(text)) !== null) {
            out.add(m[1])
        }
    }
    return [...out]
}

function parseLineItems(lineItems: unknown): ShopifyLineItem[] {
    try {
        const parsed =
            typeof lineItems === "string" ? JSON.parse(lineItems) : lineItems
        return Array.isArray(parsed) ? (parsed as ShopifyLineItem[]) : []
    } catch {
        return []
    }
}

/**
 * Build a short plain-text block of recent order context for the customer email (per store).
 * Uses CachedOrder only; does not invent data.
 * When `hintText` includes an order number (e.g. "1002"), matching rows are preferred so replies align with what the customer said.
 */
export async function buildOrderSummaryForEmail(
    storeId: string,
    customerEmail: string,
    hintText?: string
): Promise<string> {
    const normalized = customerEmail.trim().toLowerCase()
    if (!normalized) return ""

    const hints = hintText ? extractOrderNumberHints(hintText) : []

    try {
        // Match top-level email or customer.email in JSON; fetch enough rows to honor order-number hints.
        const rows = await prisma.$queryRaw<CachedOrderSummaryRow[]>`
            SELECT
                "orderNumber",
                "shopifyOrderId",
                "totalPrice",
                currency,
                "financialStatus",
                "fulfillmentStatus",
                "shopifyCreatedAt",
                "createdAt",
                "lineItems"
            FROM "CachedOrder"
            WHERE "storeId" = ${storeId}
              AND (
                LOWER(TRIM(COALESCE(email, ''))) = ${normalized}
                OR LOWER(TRIM(COALESCE(customer->>'email', ''))) = ${normalized}
              )
            ORDER BY "shopifyCreatedAt" DESC NULLS LAST, "createdAt" DESC
            LIMIT 50
        `

        let orders: CachedOrderSummaryRow[] = rows
        if (hints.length > 0) {
            const hintSet = new Set(hints)
            const matched = orders.filter((o: CachedOrderSummaryRow) =>
                hintSet.has(normalizeOrderNumberKey(o.orderNumber)),
            )
            if (matched.length > 0) {
                orders = matched.slice(0, 3)
            } else {
                orders = orders.slice(0, 3)
                logger.info("buildOrderSummaryForEmail: order number hint(s) not among email-matched orders", {
                    storeId,
                    hints,
                    senderEmail: normalized,
                    emailMatchedCount: rows.length,
                })
            }
        } else {
            orders = orders.slice(0, 3)
        }

        if (orders.length === 0) {
            logger.info("buildOrderSummaryForEmail: no CachedOrder rows for sender", {
                storeId,
                senderEmail: normalized,
                hints,
            })
            return ""
        }

        const parts: string[] = []
        for (const o of orders) {
            const when = (o.shopifyCreatedAt ?? o.createdAt).toISOString().slice(0, 10)
            const items = parseLineItems(o.lineItems)
                .slice(0, 5)
                .map((li) => {
                    const label = li.name || li.title || `product ${li.product_id ?? "?"}`
                    const q = li.quantity != null ? ` ×${li.quantity}` : ""
                    return `${label}${q}`
                })
                .join("; ")

            const line = [
                `Order ${o.orderNumber || o.shopifyOrderId} (${when})`,
                o.financialStatus ? `financial: ${o.financialStatus}` : null,
                o.fulfillmentStatus ? `fulfillment: ${o.fulfillmentStatus}` : null,
                `total: ${o.totalPrice} ${o.currency || ""}`.trim(),
                items ? `items: ${items}` : null,
            ]
                .filter(Boolean)
                .join(" | ")
            parts.push(line)
        }

        return parts.join("\n")
    } catch (e) {
        logger.error("buildOrderSummaryForEmail failed", e)
        return ""
    }
}
