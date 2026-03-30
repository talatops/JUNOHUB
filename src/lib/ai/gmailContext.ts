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
 * Remove common quoted-reply / forward blocks so stale order numbers in threads
 * are less likely to steer hint extraction (classification still uses full text elsewhere).
 */
export function stripQuotedEmailTrailForHints(text: string): string {
    if (!text.trim()) return text
    let s = text.replace(/\r\n/g, "\n")

    const markers = [
        /\nOn .{1,200}wrote:\s*\n/i,
        /\n-{3,}\s*Original Message\s*-{3,}\s*\n/i,
        /\nFrom:\s*.+\nSent:\s*.+\nTo:\s*.+\nSubject:\s*.+\n/i,
        /\n________________________________\s*\n/i,
    ]
    for (const re of markers) {
        const m = s.match(re)
        if (m?.index != null && m.index > 0) {
            s = s.slice(0, m.index)
        }
    }

    // First line starting with ">" block (lazy: cut at first heavy quote run)
    const quoteRun = s.search(/\n(?:>\s?.*\n){3,}/)
    if (quoteRun > 40) {
        s = s.slice(0, quoteRun)
    }

    return s.trim()
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

export type OrderSummaryForEmailResult = {
    /** Plain-text order lines from CachedOrder only; empty when none or when withheld (hint issues). */
    summary: string
    /** Customer named order number(s) that do not match their cached orders, or ambiguous multi-hint cases. */
    hintUnmatched: boolean
}

function orderRowMatchesAnyHint(row: CachedOrderSummaryRow, hints: string[]): boolean {
    const key = normalizeOrderNumberKey(row.orderNumber)
    return hints.some((h) => normalizeOrderNumberKey(h) === key)
}

/**
 * Build a short plain-text block of recent order context for the customer email (per store).
 * Uses CachedOrder only; does not invent data.
 * When hints exist but no row matches, returns empty summary and hintUnmatched (does not fall back to other orders).
 */
export async function buildOrderSummaryForEmail(
    storeId: string,
    customerEmail: string,
    hintText?: string
): Promise<OrderSummaryForEmailResult> {
    const normalized = customerEmail.trim().toLowerCase()
    if (!normalized) {
        return { summary: "", hintUnmatched: false }
    }

    const hints = hintText ? extractOrderNumberHints(hintText) : []

    try {
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
            const matched = orders.filter((o) => orderRowMatchesAnyHint(o, hints))
            if (matched.length === 0) {
                logger.info("buildOrderSummaryForEmail: order number hint(s) not among email-matched orders", {
                    storeId,
                    hints,
                    senderEmail: normalized,
                    emailMatchedCount: rows.length,
                })
                return { summary: "", hintUnmatched: true }
            }
            const keysMatched = new Set(matched.map((o) => normalizeOrderNumberKey(o.orderNumber)))
            const everyHintResolved = hints.every((h) => keysMatched.has(normalizeOrderNumberKey(h)))
            if (hints.length > 1 && !everyHintResolved) {
                logger.info("buildOrderSummaryForEmail: not all order hints matched cached rows", {
                    storeId,
                    hints,
                    senderEmail: normalized,
                })
                return { summary: "", hintUnmatched: true }
            }
            orders = matched.slice(0, 3)
        } else {
            orders = orders.slice(0, 3)
        }

        if (orders.length === 0) {
            logger.info("buildOrderSummaryForEmail: no CachedOrder rows for sender", {
                storeId,
                senderEmail: normalized,
                hints,
            })
            return { summary: "", hintUnmatched: false }
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

        return { summary: parts.join("\n"), hintUnmatched: false }
    } catch (e) {
        logger.error("buildOrderSummaryForEmail failed", e)
        return { summary: "", hintUnmatched: false }
    }
}
