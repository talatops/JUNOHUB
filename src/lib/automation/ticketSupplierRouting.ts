import { prisma } from "@/lib/prisma"

export type LineItemForRouting = {
    lineIndex: number
    title: string
    sku: string | null
    quantity: number
    shopifyProductId: string | null
}

export type SupplierGroup = {
    supplierUserId: string
    companyName: string
    lines: LineItemForRouting[]
}

/** Exported for unit tests. */
export function parseLineItems(raw: unknown): LineItemForRouting[] {
    if (!Array.isArray(raw)) return []
    const out: LineItemForRouting[] = []
    raw.forEach((item, idx) => {
        if (!item || typeof item !== "object") return
        const o = item as Record<string, unknown>
        const productId = o.product_id
        const pid =
            productId !== undefined && productId !== null ? String(productId) : null
        const title =
            typeof o.title === "string"
                ? o.title
                : typeof o.name === "string"
                  ? o.name
                  : "Line item"
        const skuRaw = o.sku
        const sku =
            skuRaw !== undefined && skuRaw !== null && String(skuRaw).trim() !== ""
                ? String(skuRaw).trim()
                : null
        const qty = Number(o.quantity ?? 1)
        out.push({
            lineIndex: idx,
            title,
            sku,
            quantity: Number.isFinite(qty) && qty > 0 ? Math.floor(qty) : 1,
            shopifyProductId: pid,
        })
    })
    return out
}

/**
 * Resolve cached order by order number (e.g. 1001) or Shopify numeric id string.
 */
export async function findCachedOrderForStore(params: {
    storeId: string
    orderRef: string
}): Promise<{
    shopifyOrderId: string
    orderNumber: string
    lineItems: LineItemForRouting[]
} | null> {
    const ref = params.orderRef.trim()
    if (!ref) return null

    const normalized = ref.replace(/^#/i, "").trim()

    const byNumber = await prisma.cachedOrder.findFirst({
        where: {
            storeId: params.storeId,
            OR: [
                { orderNumber: normalized },
                { orderNumber: ref },
                { shopifyOrderId: normalized },
            ],
        },
        select: {
            shopifyOrderId: true,
            orderNumber: true,
            lineItems: true,
        },
    })

    if (!byNumber) return null

    return {
        shopifyOrderId: byNumber.shopifyOrderId,
        orderNumber: byNumber.orderNumber,
        lineItems: parseLineItems(byNumber.lineItems),
    }
}

/**
 * Group order lines by supplier (ACCEPTED ProductSync per Shopify product id).
 * Lines without a mapped product id or sync are omitted.
 */
export async function groupLineItemsBySupplier(params: {
    storeId: string
    lines: LineItemForRouting[]
}): Promise<SupplierGroup[]> {
    const bySupplier = new Map<
        string,
        { companyName: string; lines: LineItemForRouting[] }
    >()

    for (const line of params.lines) {
        if (!line.shopifyProductId) continue

        const syncs = await prisma.productSync.findMany({
            where: {
                storeId: params.storeId,
                shopifyProductId: line.shopifyProductId,
                status: "ACCEPTED",
            },
            include: {
                supplier: { select: { userId: true, companyName: true } },
            },
        })

        for (const sync of syncs) {
            const uid = sync.supplier.userId
            const conn = await prisma.connection.findFirst({
                where: {
                    storeId: params.storeId,
                    supplierId: sync.supplierId,
                    status: "CONNECTED",
                },
                select: { id: true },
            })
            if (!conn) continue

            const existing = bySupplier.get(uid)
            if (existing) {
                existing.lines.push(line)
            } else {
                bySupplier.set(uid, {
                    companyName: sync.supplier.companyName,
                    lines: [line],
                })
            }
        }
    }

    return Array.from(bySupplier.entries()).map(([supplierUserId, v]) => ({
        supplierUserId,
        companyName: v.companyName,
        lines: v.lines,
    }))
}
