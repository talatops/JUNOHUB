import type { SupplierHoldReasonCode } from "@/lib/orders/supplierHoldReasons"
import {
    applyNativeFulfillmentHoldsForOrder,
    releaseNativeJunoHoldsForOrder,
} from "@/lib/shopify/fulfillmentOrderHoldGraphql"

export const JUNO_ON_HOLD_TAG = "JUNO_ON_HOLD"

export const SUPPLIER_HOLD_METAFIELD = {
    namespace: "juno",
    key: "supplier_hold",
} as const

/** Shopify order tags are comma-separated; preserve casing of existing tags except our token. */
export function mergeTagsAddHold(tagsCsv: string | null | undefined): string {
    const parts = (tagsCsv ?? "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    const upper = new Set(parts.map((p) => p.toUpperCase()))
    if (!upper.has(JUNO_ON_HOLD_TAG.toUpperCase())) {
        parts.push(JUNO_ON_HOLD_TAG)
    }
    return parts.join(", ")
}

export function mergeTagsRemoveHold(tagsCsv: string | null | undefined): string {
    const parts = (tagsCsv ?? "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    return parts.filter((p) => p.toUpperCase() !== JUNO_ON_HOLD_TAG.toUpperCase()).join(", ")
}

export function buildSupplierHoldMetafieldJson(code: SupplierHoldReasonCode, note: string | null): string {
    const payload = {
        code,
        note: note?.trim() ?? "",
        updatedAt: new Date().toISOString(),
    }
    return JSON.stringify(payload)
}

type ShopifyMetafieldRow = { id?: number; namespace?: string; key?: string }

async function shopifyJson<T>(
    url: string,
    accessToken: string,
    init?: RequestInit,
): Promise<{ ok: boolean; status: number; data: T | null; text: string }> {
    const res = await fetch(url, {
        ...init,
        headers: {
            "X-Shopify-Access-Token": accessToken,
            "Content-Type": "application/json",
            ...(init?.headers as Record<string, string>),
        },
    })
    const text = await res.text().catch(() => "")
    let data: T | null = null
    try {
        data = text ? (JSON.parse(text) as T) : null
    } catch {
        data = null
    }
    return { ok: res.ok, status: res.status, data, text }
}

/**
 * Set hold tag + `juno.supplier_hold` JSON metafield on the order (REST Admin API 2024-01).
 */
export async function pushOnHoldToShopify(params: {
    cleanDomain: string
    accessToken: string
    shopifyOrderId: string
    code: SupplierHoldReasonCode
    note: string | null
}): Promise<{ ok: boolean; error?: string }> {
    const { cleanDomain, accessToken, shopifyOrderId, code, note } = params

    const native = await applyNativeFulfillmentHoldsForOrder({
        cleanDomain,
        accessToken,
        orderNumericId: shopifyOrderId,
        code,
        note,
    })
    if (!native.ok) {
        return {
            ok: false,
            error: `Fulfillment hold (Shopify): ${native.error || "unknown error"}. Ensure the Admin API token includes write_merchant_managed_fulfillment_orders (or write_third_party_fulfillment_orders).`,
        }
    }

    const base = `https://${cleanDomain}/admin/api/2024-01`

    const orderRes = await shopifyJson<{ order?: { id?: number; tags?: string } }>(
        `${base}/orders/${shopifyOrderId}.json`,
        accessToken,
    )
    if (!orderRes.ok || !orderRes.data?.order?.id) {
        return {
            ok: false,
            error: `Failed to read Shopify order: ${orderRes.status} ${orderRes.text.slice(0, 300)}`,
        }
    }
    const numericId = orderRes.data.order.id
    const newTags = mergeTagsAddHold(orderRes.data.order.tags)

    const putOrder = await shopifyJson<{ order?: { id?: number } }>(`${base}/orders/${shopifyOrderId}.json`, accessToken, {
        method: "PUT",
        body: JSON.stringify({ order: { id: numericId, tags: newTags } }),
    })
    if (!putOrder.ok) {
        return {
            ok: false,
            error: `Failed to update order tags: ${putOrder.status} ${putOrder.text.slice(0, 300)}`,
        }
    }

    const mfValue = buildSupplierHoldMetafieldJson(code, note)

    const listMf = await shopifyJson<{ metafields?: ShopifyMetafieldRow[] }>(
        `${base}/orders/${shopifyOrderId}/metafields.json`,
        accessToken,
    )
    if (!listMf.ok) {
        return {
            ok: false,
            error: `Failed to list order metafields: ${listMf.status} ${listMf.text.slice(0, 300)}`,
        }
    }
    const existing = (listMf.data?.metafields || []).find(
        (m) => m.namespace === SUPPLIER_HOLD_METAFIELD.namespace && m.key === SUPPLIER_HOLD_METAFIELD.key,
    )

    if (existing?.id) {
        const putMf = await shopifyJson<{ metafield?: { id?: number } }>(
            `${base}/metafields/${existing.id}.json`,
            accessToken,
            {
                method: "PUT",
                body: JSON.stringify({
                    metafield: {
                        id: existing.id,
                        type: "json",
                        value: mfValue,
                    },
                }),
            },
        )
        if (!putMf.ok) {
            return {
                ok: false,
                error: `Failed to update hold metafield: ${putMf.status} ${putMf.text.slice(0, 300)}`,
            }
        }
    } else {
        const postMf = await shopifyJson<{ metafield?: { id?: number } }>(
            `${base}/orders/${shopifyOrderId}/metafields.json`,
            accessToken,
            {
                method: "POST",
                body: JSON.stringify({
                    metafield: {
                        namespace: SUPPLIER_HOLD_METAFIELD.namespace,
                        key: SUPPLIER_HOLD_METAFIELD.key,
                        type: "json",
                        value: mfValue,
                    },
                }),
            },
        )
        if (!postMf.ok) {
            return {
                ok: false,
                error: `Failed to create hold metafield: ${postMf.status} ${postMf.text.slice(0, 300)}`,
            }
        }
    }

    return { ok: true }
}

/** Remove hold tag and delete `juno.supplier_hold` metafield if present. */
export async function clearOnHoldOnShopify(params: {
    cleanDomain: string
    accessToken: string
    shopifyOrderId: string
}): Promise<{ ok: boolean; error?: string }> {
    const { cleanDomain, accessToken, shopifyOrderId } = params

    const released = await releaseNativeJunoHoldsForOrder({
        cleanDomain,
        accessToken,
        orderNumericId: shopifyOrderId,
    })
    if (!released.ok) {
        return {
            ok: false,
            error: `Release fulfillment hold: ${released.error || "unknown error"}`,
        }
    }

    const base = `https://${cleanDomain}/admin/api/2024-01`

    const orderRes = await shopifyJson<{ order?: { id?: number; tags?: string } }>(
        `${base}/orders/${shopifyOrderId}.json`,
        accessToken,
    )
    if (!orderRes.ok || !orderRes.data?.order?.id) {
        return {
            ok: false,
            error: `Failed to read Shopify order: ${orderRes.status} ${orderRes.text.slice(0, 300)}`,
        }
    }
    const numericId = orderRes.data.order.id
    const newTags = mergeTagsRemoveHold(orderRes.data.order.tags)

    const putOrder = await shopifyJson<{ order?: { id?: number } }>(`${base}/orders/${shopifyOrderId}.json`, accessToken, {
        method: "PUT",
        body: JSON.stringify({ order: { id: numericId, tags: newTags } }),
    })
    if (!putOrder.ok) {
        return {
            ok: false,
            error: `Failed to update order tags: ${putOrder.status} ${putOrder.text.slice(0, 300)}`,
        }
    }

    const listMf = await shopifyJson<{ metafields?: ShopifyMetafieldRow[] }>(
        `${base}/orders/${shopifyOrderId}/metafields.json`,
        accessToken,
    )
    if (listMf.ok && listMf.data?.metafields) {
        const existing = listMf.data.metafields.find(
            (m) => m.namespace === SUPPLIER_HOLD_METAFIELD.namespace && m.key === SUPPLIER_HOLD_METAFIELD.key,
        )
        if (existing?.id) {
            const del = await shopifyJson<unknown>(`${base}/metafields/${existing.id}.json`, accessToken, {
                method: "DELETE",
            })
            if (!del.ok) {
                return {
                    ok: false,
                    error: `Failed to delete hold metafield: ${del.status} ${del.text.slice(0, 300)}`,
                }
            }
        }
    }

    return { ok: true }
}
