const SHOPIFY_API_VERSION = "2024-01"

function cleanShopDomain(shopifyDomain: string): string {
    return shopifyDomain.trim().replace(/^https?:\/\//, "").replace(/\/$/, "").trim()
}

async function shopifyAdminJson<T>(
    cleanDomain: string,
    accessToken: string,
    path: string,
    init?: RequestInit
): Promise<{ ok: boolean; status: number; data: T }> {
    const url = `https://${cleanDomain}/admin/api/${SHOPIFY_API_VERSION}${path}`
    const method = init?.method ?? "GET"
    const write = method !== "GET" && method !== "HEAD"
    const response = await fetch(url, {
        ...init,
        headers: {
            "X-Shopify-Access-Token": accessToken,
            ...(write ? { "Content-Type": "application/json" } : {}),
        },
    })
    const data = (await response.json().catch(() => ({}))) as T
    return { ok: response.ok, status: response.status, data }
}

export function formatShopifyAdminError(data: unknown): string {
    if (data == null) return "Shopify request failed"
    if (typeof data === "string" && data.trim()) return data
    if (typeof data !== "object") return "Shopify request failed"
    const d = data as Record<string, unknown>
    if (typeof d.message === "string" && d.message.trim()) return d.message
    const errs = d.errors
    if (typeof errs === "string" && errs.trim()) return errs
    if (errs !== undefined) {
        try {
            return JSON.stringify(errs)
        } catch {
            return "Shopify validation error"
        }
    }
    return "Shopify request failed"
}

/** First active location id (requires read_locations — often missing on minimal custom apps). */
export async function getActiveLocationId(
    shopifyDomain: string,
    accessToken: string
): Promise<{ locationId: number } | { error: string }> {
    const cleanDomain = cleanShopDomain(shopifyDomain)
    const { ok, status, data } = await shopifyAdminJson<{ locations?: { id: number; active: boolean }[] }>(
        cleanDomain,
        accessToken,
        "/locations.json"
    )
    if (!ok) {
        return { error: `Could not load locations (${status}): ${formatShopifyAdminError(data)}` }
    }
    const locations = data.locations || []
    const active = locations.find((l) => l.active) ?? locations[0]
    if (!active) {
        return { error: "No Shopify locations found for this store." }
    }
    return { locationId: active.id }
}

/**
 * Locations where this inventory item already has levels (read_inventory — no read_locations).
 */
async function getInventoryLevelsForItem(
    cleanDomain: string,
    accessToken: string,
    inventoryItemId: number
): Promise<
    | { ok: true; levels: { location_id: number }[] }
    | { ok: false; status: number; data: unknown }
> {
    const path = `/inventory_levels.json?inventory_item_ids=${encodeURIComponent(String(inventoryItemId))}`
    const { ok, status, data } = await shopifyAdminJson<{ inventory_levels?: { location_id: number }[] }>(
        cleanDomain,
        accessToken,
        path
    )
    if (!ok) {
        return { ok: false, status, data }
    }
    const levels = Array.isArray(data.inventory_levels) ? data.inventory_levels : []
    return { ok: true, levels }
}

/** Connect tracked inventory to a location so adjust can run (write_inventory). */
async function connectInventoryAtLocation(
    cleanDomain: string,
    accessToken: string,
    inventoryItemId: number,
    locationId: number
): Promise<{ ok: true } | { error: string; status: number }> {
    const { ok, status, data } = await shopifyAdminJson<unknown>(cleanDomain, accessToken, "/inventory_levels/connect.json", {
        method: "POST",
        body: JSON.stringify({
            inventory_item_id: inventoryItemId,
            location_id: locationId,
        }),
    })
    if (ok) return { ok: true }
    const msg = formatShopifyAdminError(data)
    if (status === 422 && /already (?:been )?connected|already exists/i.test(msg)) {
        return { ok: true }
    }
    return { error: msg, status: status >= 400 && status < 600 ? status : 502 }
}

/**
 * Resolves location_id for inventory_levels/adjust without requiring read_locations when possible:
 * 1) Existing inventory level for this item (read_inventory)
 * 2) Else list locations + connect item (read_locations + write_inventory)
 */
export async function resolveLocationIdForInventoryAdjust(
    shopifyDomain: string,
    accessToken: string,
    inventoryItemId: number
): Promise<{ locationId: number } | { error: string; status?: number }> {
    const cleanDomain = cleanShopDomain(shopifyDomain)

    const fromLevels = await getInventoryLevelsForItem(cleanDomain, accessToken, inventoryItemId)
    if (!fromLevels.ok) {
        const detail = formatShopifyAdminError(fromLevels.data)
        return {
            error: `Could not read inventory levels (${fromLevels.status}): ${detail}`,
            status: fromLevels.status >= 400 && fromLevels.status < 600 ? fromLevels.status : 502,
        }
    }

    if (fromLevels.levels.length > 0) {
        return { locationId: fromLevels.levels[0].location_id }
    }

    const loc = await getActiveLocationId(shopifyDomain, accessToken)
    if ("error" in loc) {
        return {
            error:
                `This product has no inventory level at a location yet. Your token cannot list locations (often missing read_locations scope). ` +
                `Either add the **read_locations** scope to your Shopify custom app and save a new Admin API token in JunoHub, or open Shopify Admin and assign this product to a fulfillment location so it has stock. ` +
                `Original error: ${loc.error}`,
            status: 403,
        }
    }

    const connected = await connectInventoryAtLocation(cleanDomain, accessToken, inventoryItemId, loc.locationId)
    if ("error" in connected) {
        return {
            error: `Could not connect inventory to a location: ${connected.error}`,
            status: connected.status,
        }
    }

    return { locationId: loc.locationId }
}

/**
 * First variant's inventory_item_id (v1: load stock applies to first variant only).
 */
export async function getFirstVariantInventoryItemId(
    shopifyDomain: string,
    accessToken: string,
    shopifyProductId: string
): Promise<{ inventoryItemId: number } | { error: string }> {
    const cleanDomain = cleanShopDomain(shopifyDomain)
    const { ok, status, data } = await shopifyAdminJson<{ product?: { variants?: { inventory_item_id?: number }[] } }>(
        cleanDomain,
        accessToken,
        `/products/${encodeURIComponent(shopifyProductId)}.json`
    )
    if (!ok) {
        return { error: `Could not load product (${status}): ${formatShopifyAdminError(data)}` }
    }
    const variants = data.product?.variants
    const first = variants?.[0]
    const inventoryItemId = first?.inventory_item_id
    if (inventoryItemId === undefined || inventoryItemId === null || Number.isNaN(Number(inventoryItemId))) {
        return { error: "Product has no variant with inventory tracking (inventory_item_id missing)." }
    }
    return { inventoryItemId: Number(inventoryItemId) }
}

/**
 * Relative adjustment to available quantity at a location (positive = increase sellable stock).
 */
export async function adjustAvailableInventory(
    shopifyDomain: string,
    accessToken: string,
    params: { inventoryItemId: number; locationId: number; availableAdjustment: number }
): Promise<{ ok: true } | { error: string; status: number }> {
    const cleanDomain = cleanShopDomain(shopifyDomain)
    const body = {
        inventory_item_id: params.inventoryItemId,
        location_id: params.locationId,
        available_adjustment: params.availableAdjustment,
    }
    const { ok, status, data } = await shopifyAdminJson<unknown>(cleanDomain, accessToken, "/inventory_levels/adjust.json", {
        method: "POST",
        body: JSON.stringify(body),
    })
    if (!ok) {
        return {
            error: formatShopifyAdminError(data),
            status: status >= 400 && status < 600 ? status : 502,
        }
    }
    return { ok: true }
}
