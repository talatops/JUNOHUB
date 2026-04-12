import { prisma } from "@/lib/prisma"
import { normalizeFulfillmentStatus } from "@/lib/orders/fulfillmentStatus"

/**
 * Create/update Shopify fulfillment + tracking for SHIPPED / FULFILLED only.
 * Other statuses no-op with ok: true.
 */
export async function syncOrderFulfillmentToShopify(
    storeId: string,
    shopifyOrderId: string,
    fulfillmentStatus: string,
    trackingNumber: string | null,
    trackingCompany: string | null,
    trackingUrl: string | null,
): Promise<{ ok: boolean; error?: string }> {
    const canonical = normalizeFulfillmentStatus(fulfillmentStatus)
    if (canonical !== "SHIPPED" && canonical !== "FULFILLED") {
        return { ok: true }
    }
    if (!trackingNumber || !trackingCompany) {
        return { ok: false, error: "Tracking platform and tracking number are required for shipped/fulfilled sync." }
    }

    const store = await prisma.store.findUnique({
        where: { id: storeId },
        select: { shopifyDomain: true, shopifyAccessToken: true },
    })
    if (!store?.shopifyDomain || !store?.shopifyAccessToken) {
        return { ok: false, error: "Shopify store not connected." }
    }
    const cleanDomain = store.shopifyDomain.trim().replace(/^https?:\/\//, "").replace(/\/$/, "")

    const fetchScopes = async (): Promise<string[]> => {
        try {
            const res = await fetch(`https://${cleanDomain}/admin/oauth/access_scopes.json`, {
                method: "GET",
                headers: {
                    "X-Shopify-Access-Token": store.shopifyAccessToken,
                    "Content-Type": "application/json",
                },
            })
            if (!res.ok) return []
            const payload = (await res.json()) as { access_scopes?: Array<{ handle?: string }> }
            return (payload.access_scopes || []).map((s) => s.handle || "").filter(Boolean)
        } catch {
            return []
        }
    }

    const updateTrackingOnExistingFulfillment = async (): Promise<{ ok: boolean; error?: string }> => {
        const listRes = await fetch(
            `https://${cleanDomain}/admin/api/2024-01/orders/${shopifyOrderId}/fulfillments.json`,
            {
                method: "GET",
                headers: {
                    "X-Shopify-Access-Token": store.shopifyAccessToken,
                    "Content-Type": "application/json",
                },
            },
        )
        if (!listRes.ok) {
            const details = await listRes.text().catch(() => "Unknown Shopify response")
            return { ok: false, error: `Read existing fulfillments failed: ${details}` }
        }

        const listPayload = (await listRes.json()) as {
            fulfillments?: Array<{ id: number; created_at?: string }>
        }
        const fulfillments = listPayload.fulfillments || []
        if (fulfillments.length === 0) {
            return { ok: false, error: "No existing fulfillment found to update tracking." }
        }

        const sorted = [...fulfillments].sort((a, b) => {
            const aTs = a.created_at ? new Date(a.created_at).getTime() : 0
            const bTs = b.created_at ? new Date(b.created_at).getTime() : 0
            return bTs - aTs
        })
        const latest = sorted[0]

        const updateRes = await fetch(
            `https://${cleanDomain}/admin/api/2024-01/fulfillments/${latest.id}/update_tracking.json`,
            {
                method: "POST",
                headers: {
                    "X-Shopify-Access-Token": store.shopifyAccessToken,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    fulfillment: {
                        notify_customer: false,
                        tracking_info: {
                            number: trackingNumber,
                            company: trackingCompany,
                            url: trackingUrl || undefined,
                        },
                    },
                }),
            },
        )
        if (!updateRes.ok) {
            const details = await updateRes.text().catch(() => "Unknown Shopify response")
            return { ok: false, error: `Update tracking on existing fulfillment failed: ${details}` }
        }
        return { ok: true }
    }

    const createLegacyFulfillmentFallback = async (): Promise<{ ok: boolean; error?: string }> => {
        const orderRes = await fetch(
            `https://${cleanDomain}/admin/api/2024-01/orders/${shopifyOrderId}.json?status=any`,
            {
                method: "GET",
                headers: {
                    "X-Shopify-Access-Token": store.shopifyAccessToken,
                    "Content-Type": "application/json",
                },
            },
        )
        if (!orderRes.ok) {
            const details = await orderRes.text().catch(() => "Unknown Shopify response")
            return { ok: false, error: `Fallback fetch order failed: ${details}` }
        }

        const orderPayload = (await orderRes.json()) as {
            order?: {
                line_items?: Array<{ id: number; fulfillable_quantity?: number; quantity?: number }>
            }
        }
        const lineItems = (orderPayload.order?.line_items || [])
            .filter((li) => (li.fulfillable_quantity ?? li.quantity ?? 0) > 0)
            .map((li) => ({
                id: li.id,
                quantity: li.fulfillable_quantity ?? li.quantity ?? 1,
            }))

        const legacyPayload = {
            fulfillment: {
                notify_customer: false,
                tracking_number: trackingNumber,
                tracking_company: trackingCompany,
                tracking_urls: trackingUrl ? [trackingUrl] : undefined,
                line_items: lineItems.length > 0 ? lineItems : undefined,
            },
        }

        const legacyRes = await fetch(
            `https://${cleanDomain}/admin/api/2024-01/orders/${shopifyOrderId}/fulfillments.json`,
            {
                method: "POST",
                headers: {
                    "X-Shopify-Access-Token": store.shopifyAccessToken,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(legacyPayload),
            },
        )
        if (!legacyRes.ok) {
            const details = await legacyRes.text().catch(() => "Unknown Shopify response")
            return { ok: false, error: `Legacy fulfillment failed: ${details}` }
        }
        return { ok: true }
    }

    const foRes = await fetch(
        `https://${cleanDomain}/admin/api/2024-01/orders/${shopifyOrderId}/fulfillment_orders.json`,
        {
            method: "GET",
            headers: {
                "X-Shopify-Access-Token": store.shopifyAccessToken,
                "Content-Type": "application/json",
            },
        },
    )
    if (!foRes.ok) {
        const details = await foRes.text().catch(() => "Unknown Shopify response")
        const fallback = await createLegacyFulfillmentFallback()
        if (fallback.ok) return fallback
        const scopes = await fetchScopes()
        return {
            ok: false,
            error: `Failed to read fulfillment orders: ${details}. Fallback also failed: ${fallback.error}. Token scopes: [${scopes.join(", ")}]. Re-install/reconnect app after scope changes.`,
        }
    }

    const foJson = (await foRes.json()) as {
        fulfillment_orders?: Array<{ id: number; status?: string; request_status?: string }>
    }
    const allFulfillmentOrders = foJson.fulfillment_orders || []
    const fulfillmentOrders = allFulfillmentOrders.filter((fo) => {
        const status = String(fo.status || "").toLowerCase()
        return status && status !== "closed" && status !== "cancelled" && status !== "incomplete"
    })
    if (fulfillmentOrders.length === 0) {
        const closedCount = allFulfillmentOrders.filter((fo) => String(fo.status || "").toLowerCase() === "closed").length
        if (closedCount > 0) {
            const updated = await updateTrackingOnExistingFulfillment()
            if (updated.ok) return updated
            return { ok: false, error: `All fulfillment orders are closed. ${updated.error}` }
        }
        return { ok: false, error: "No actionable fulfillment orders available for this order." }
    }

    const payload = {
        fulfillment: {
            notify_customer: false,
            tracking_info: {
                number: trackingNumber,
                company: trackingCompany,
                url: trackingUrl || undefined,
            },
            line_items_by_fulfillment_order: fulfillmentOrders.map((f) => ({
                fulfillment_order_id: f.id,
            })),
        },
    }

    const syncRes = await fetch(`https://${cleanDomain}/admin/api/2024-01/fulfillments.json`, {
        method: "POST",
        headers: {
            "X-Shopify-Access-Token": store.shopifyAccessToken,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    })
    if (!syncRes.ok) {
        const details = await syncRes.text().catch(() => "Unknown Shopify response")
        const updated = await updateTrackingOnExistingFulfillment()
        if (updated.ok) return updated
        const fallback = await createLegacyFulfillmentFallback()
        if (fallback.ok) return fallback
        const scopes = await fetchScopes()
        return {
            ok: false,
            error: `Shopify fulfillment sync failed: ${details}. Existing fulfillment tracking update failed: ${updated.error}. Fallback also failed: ${fallback.error}. Token scopes: [${scopes.join(", ")}]. Re-install/reconnect app after scope changes.`,
        }
    }

    return { ok: true }
}
