/**
 * Native Shopify fulfillment holds (Admin GraphQL) so orders show "On hold" in admin,
 * not only the JUNO_ON_HOLD tag.
 *
 * Requires scope: write_merchant_managed_fulfillment_orders (or third_party variant) +
 * fulfill_and_ship_orders staff permission on the token.
 */
import type { SupplierHoldReasonCode } from "@/lib/orders/supplierHoldReasons"
import { SUPPLIER_HOLD_REASON_LABELS } from "@/lib/orders/supplierHoldReasons"

/** Same handle every time so we can release/update without touching merchant holds. */
export const JUNO_FULFILLMENT_HOLD_HANDLE = "juno_supplier_hold"

const GRAPHQL_API = "2024-10"

const FO_SKIP_HOLD = new Set(["CLOSED", "CANCELLED", "INCOMPLETE"])

type GraphqlResponse<T> = {
    data?: T
    errors?: Array<{ message?: string }>
}

async function shopifyAdminGraphql<T>(
    cleanDomain: string,
    accessToken: string,
    query: string,
    variables?: Record<string, unknown>,
): Promise<{ ok: boolean; data: T | null; error?: string; raw: string }> {
    const res = await fetch(`https://${cleanDomain}/admin/api/${GRAPHQL_API}/graphql.json`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": accessToken,
        },
        body: JSON.stringify({ query, variables }),
    })
    const raw = await res.text().catch(() => "")
    let parsed: GraphqlResponse<T> = {}
    try {
        parsed = raw ? (JSON.parse(raw) as GraphqlResponse<T>) : {}
    } catch {
        return { ok: false, data: null, error: "Invalid JSON from Shopify GraphQL", raw }
    }
    if (parsed.errors?.length) {
        const msg = parsed.errors.map((e) => e.message).filter(Boolean).join("; ")
        return { ok: false, data: parsed.data ?? null, error: msg || "GraphQL error", raw }
    }
    if (!res.ok) {
        return { ok: false, data: null, error: `HTTP ${res.status}: ${raw.slice(0, 400)}`, raw }
    }
    return { ok: true, data: parsed.data ?? null, raw }
}

type FoNode = {
    id: string
    status: string
    fulfillmentHolds?: Array<{ id: string; handle?: string | null }>
}

type OrderFoQuery = {
    order: {
        fulfillmentOrders: {
            edges: Array<{ node: FoNode }>
        } | null
    } | null
}

const ORDER_FULFILLMENT_ORDERS = `
query OrderFulfillmentOrders($orderId: ID!) {
  order(id: $orderId) {
    fulfillmentOrders(first: 25) {
      edges {
        node {
          id
          status
          fulfillmentHolds {
            id
            handle
          }
        }
      }
    }
  }
}
`

export function shopifyFulfillmentHoldReason(code: SupplierHoldReasonCode): string {
    const m: Record<SupplierHoldReasonCode, string> = {
        inventory_out_of_stock: "INVENTORY_OUT_OF_STOCK",
        address_incorrect: "INCORRECT_ADDRESS",
        high_risk_fraud: "HIGH_RISK_OF_FRAUD",
        awaiting_payment: "AWAITING_PAYMENT",
        other: "OTHER",
    }
    return m[code]
}

/** Text shown on the hold in Shopify admin (reason notes). */
export function shopifyFulfillmentHoldNotes(code: SupplierHoldReasonCode, note: string | null): string {
    const label = SUPPLIER_HOLD_REASON_LABELS[code]
    if (code === "other") {
        return (note?.trim() || label).slice(0, 500)
    }
    const extra = note?.trim()
    const base = `Supplier (JUNO): ${label}`
    return extra ? `${base} — ${extra}`.slice(0, 500) : base
}

async function listFulfillmentOrdersForOrder(
    cleanDomain: string,
    accessToken: string,
    orderNumericId: string,
): Promise<{ ok: boolean; nodes: FoNode[]; error?: string }> {
    const orderGid = `gid://shopify/Order/${orderNumericId}`
    const r = await shopifyAdminGraphql<OrderFoQuery>(
        cleanDomain,
        accessToken,
        ORDER_FULFILLMENT_ORDERS,
        { orderId: orderGid },
    )
    if (!r.ok || !r.data?.order) {
        return { ok: false, nodes: [], error: r.error || "Order not found in GraphQL" }
    }
    const edges = r.data.order.fulfillmentOrders?.edges || []
    return { ok: true, nodes: edges.map((e) => e.node) }
}

const MUTATION_RELEASE = `
mutation ReleaseHolds($id: ID!, $holdIds: [ID!]!) {
  fulfillmentOrderReleaseHold(id: $id, holdIds: $holdIds) {
    userErrors { field message }
  }
}
`

const MUTATION_HOLD = `
mutation ApplyHold($id: ID!, $hold: FulfillmentOrderHoldInput!) {
  fulfillmentOrderHold(id: $id, fulfillmentHold: $hold) {
    userErrors { field message }
  }
}
`

async function releaseJunoHoldsOnFo(
    cleanDomain: string,
    accessToken: string,
    foId: string,
    holds: Array<{ id: string; handle?: string | null }>,
): Promise<{ ok: boolean; error?: string }> {
    const ids = holds
        .filter((h) => (h.handle || "") === JUNO_FULFILLMENT_HOLD_HANDLE)
        .map((h) => h.id)
    if (ids.length === 0) return { ok: true }
    const r = await shopifyAdminGraphql<{ fulfillmentOrderReleaseHold: { userErrors: Array<{ message: string }> } }>(
        cleanDomain,
        accessToken,
        MUTATION_RELEASE,
        { id: foId, holdIds: ids },
    )
    if (!r.ok) return { ok: false, error: r.error }
    const errs = r.data?.fulfillmentOrderReleaseHold?.userErrors || []
    if (errs.length) {
        return { ok: false, error: errs.map((e) => e.message).join("; ") }
    }
    return { ok: true }
}

async function applyJunoHoldOnFo(
    cleanDomain: string,
    accessToken: string,
    foId: string,
    reason: string,
    reasonNotes: string,
): Promise<{ ok: boolean; error?: string }> {
    const r = await shopifyAdminGraphql<{ fulfillmentOrderHold: { userErrors: Array<{ message: string }> } }>(
        cleanDomain,
        accessToken,
        MUTATION_HOLD,
        {
            id: foId,
            hold: {
                handle: JUNO_FULFILLMENT_HOLD_HANDLE,
                reason,
                reasonNotes,
                notifyMerchant: false,
            },
        },
    )
    if (!r.ok) return { ok: false, error: r.error }
    const errs = r.data?.fulfillmentOrderHold?.userErrors || []
    if (errs.length) {
        return { ok: false, error: errs.map((e) => e.message).join("; ") }
    }
    return { ok: true }
}

/**
 * Places Shopify-native fulfillment holds on all actionable fulfillment orders for this order.
 */
export async function applyNativeFulfillmentHoldsForOrder(params: {
    cleanDomain: string
    accessToken: string
    orderNumericId: string
    code: SupplierHoldReasonCode
    note: string | null
}): Promise<{ ok: boolean; error?: string; appliedCount: number }> {
    const { cleanDomain, accessToken, orderNumericId, code, note } = params
    const listed = await listFulfillmentOrdersForOrder(cleanDomain, accessToken, orderNumericId)
    if (!listed.ok) {
        return { ok: false, error: listed.error, appliedCount: 0 }
    }
    const reason = shopifyFulfillmentHoldReason(code)
    const reasonNotes = shopifyFulfillmentHoldNotes(code, note)

    for (const fo of listed.nodes) {
        const rel = await releaseJunoHoldsOnFo(cleanDomain, accessToken, fo.id, fo.fulfillmentHolds || [])
        if (!rel.ok) {
            return { ok: false, error: rel.error, appliedCount: 0 }
        }
    }

    let appliedCount = 0
    for (const fo of listed.nodes) {
        if (FO_SKIP_HOLD.has(String(fo.status || "").toUpperCase())) {
            continue
        }
        const app = await applyJunoHoldOnFo(cleanDomain, accessToken, fo.id, reason, reasonNotes)
        if (!app.ok) {
            return { ok: false, error: app.error, appliedCount }
        }
        appliedCount += 1
    }

    if (appliedCount === 0 && listed.nodes.length === 0) {
        return {
            ok: true,
            appliedCount: 0,
            error: undefined,
        }
    }

    return { ok: true, appliedCount }
}

/**
 * Releases JUNO fulfillment holds only (leaves other holds intact).
 */
export async function releaseNativeJunoHoldsForOrder(params: {
    cleanDomain: string
    accessToken: string
    orderNumericId: string
}): Promise<{ ok: boolean; error?: string }> {
    const { cleanDomain, accessToken, orderNumericId } = params
    const listed = await listFulfillmentOrdersForOrder(cleanDomain, accessToken, orderNumericId)
    if (!listed.ok) {
        return { ok: false, error: listed.error }
    }
    for (const fo of listed.nodes) {
        const rel = await releaseJunoHoldsOnFo(cleanDomain, accessToken, fo.id, fo.fulfillmentHolds || [])
        if (!rel.ok) {
            return { ok: false, error: rel.error }
        }
    }
    return { ok: true }
}
