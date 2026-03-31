import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { normalizeFulfillmentStatus, toVendorDisplayStatus } from "@/lib/orders/fulfillmentStatus"

async function getSupplierContext(userId: string) {
    const profile = await prisma.supplierProfile.findUnique({
        where: { userId },
        select: { id: true },
    })
    if (!profile) return null

    const acceptedSyncs = await prisma.productSync.findMany({
        where: { supplierId: profile.id, status: "ACCEPTED" },
        select: { storeId: true, shopifyProductId: true },
    })

    const syncsByStore = new Map<string, Set<string>>()
    for (const sync of acceptedSyncs) {
        if (!syncsByStore.has(sync.storeId)) syncsByStore.set(sync.storeId, new Set())
        syncsByStore.get(sync.storeId)!.add(sync.shopifyProductId)
    }

    return { profile, syncsByStore }
}

function extractLineItems(lineItems: unknown): Array<{ product_id?: number }> {
    try {
        const parsed = typeof lineItems === "string" ? JSON.parse(lineItems) : lineItems
        return Array.isArray(parsed) ? (parsed as Array<{ product_id?: number }>) : []
    } catch {
        return []
    }
}

function toObject(value: unknown): Record<string, unknown> | null {
    return value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null
}

function isSupplierAllowedForOrder(
    syncsByStore: Map<string, Set<string>>,
    storeId: string,
    lineItems: unknown,
) {
    const syncedProductIds = syncsByStore.get(storeId)
    if (!syncedProductIds || syncedProductIds.size === 0) return false
    const items = extractLineItems(lineItems)
    return items.some((item) => {
        const pid = item.product_id?.toString()
        return !!pid && syncedProductIds.has(pid)
    })
}

async function syncOrderToShopify(
    storeId: string,
    shopifyOrderId: string,
    fulfillmentStatus: string,
    trackingNumber: string | null,
    trackingCompany: string | null,
    trackingUrl: string | null,
): Promise<{ ok: boolean; error?: string }> {
    const canonical = normalizeFulfillmentStatus(fulfillmentStatus)
    if (canonical !== "SHIPPED" && canonical !== "FULFILLED") {
        // No fulfillment push needed for non-shipped statuses.
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

    const foJson = (await foRes.json()) as { fulfillment_orders?: Array<{ id: number }> }
    const fulfillmentOrders = foJson.fulfillment_orders || []
    if (fulfillmentOrders.length === 0) {
        return { ok: false, error: "No fulfillment orders available for this order." }
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
        const fallback = await createLegacyFulfillmentFallback()
        if (fallback.ok) return fallback
        const scopes = await fetchScopes()
        return {
            ok: false,
            error: `Shopify fulfillment sync failed: ${details}. Fallback also failed: ${fallback.error}. Token scopes: [${scopes.join(", ")}]. Re-install/reconnect app after scope changes.`,
        }
    }

    return { ok: true }
}

export async function GET(
    _req: Request,
    { params }: { params: Promise<{ orderId: string }> },
) {
    try {
        const session = await auth()
        if (!session?.user?.id || session.user.role !== "SUPPLIER") {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        const { orderId } = await params
        const ctx = await getSupplierContext(session.user.id)
        if (!ctx) {
            return NextResponse.json({ message: "Supplier profile not found" }, { status: 404 })
        }

        const order = await prisma.cachedOrder.findFirst({
            where: { shopifyOrderId: orderId },
            include: {
                store: {
                    select: { id: true, businessName: true, shopifyStoreName: true },
                },
            },
        })

        if (!order) {
            return NextResponse.json({ message: "Order not found" }, { status: 404 })
        }

        if (!isSupplierAllowedForOrder(ctx.syncsByStore, order.storeId, order.lineItems)) {
            return NextResponse.json({ message: "Order not accessible" }, { status: 403 })
        }

        let liveOrder: Record<string, unknown> | null = null
        try {
            const storeCredentials = await prisma.store.findUnique({
                where: { id: order.storeId },
                select: { shopifyDomain: true, shopifyAccessToken: true },
            })
            if (storeCredentials?.shopifyDomain && storeCredentials?.shopifyAccessToken) {
                const cleanDomain = storeCredentials.shopifyDomain
                    .trim()
                    .replace(/^https?:\/\//, "")
                    .replace(/\/$/, "")

                const response = await fetch(
                    `https://${cleanDomain}/admin/api/2024-01/orders/${orderId}.json`,
                    {
                        method: "GET",
                        headers: {
                            "X-Shopify-Access-Token": storeCredentials.shopifyAccessToken,
                            "Content-Type": "application/json",
                        },
                    },
                )
                if (response.ok) {
                    const payload = (await response.json()) as { order?: Record<string, unknown> }
                    liveOrder = toObject(payload.order)
                }
            }
        } catch (e) {
            console.error("[SUPPLIER_ORDER_GET_SHOPIFY]", e)
        }

        const cachedCustomer = toObject(order.customer)
        const customer = toObject(liveOrder?.customer) || cachedCustomer
        const shippingAddress = toObject(liveOrder?.shipping_address)
        const billingAddress = toObject(liveOrder?.billing_address)
        const lineItems = Array.isArray(liveOrder?.line_items)
            ? (liveOrder?.line_items as Array<{ product_id?: number }>)
            : extractLineItems(order.lineItems)

        return NextResponse.json({
            order: {
                id: order.shopifyOrderId,
                orderNumber: order.orderNumber,
                email: (typeof liveOrder?.email === "string" && liveOrder.email) || order.email,
                totalPrice: order.totalPrice,
                currency: order.currency,
                financialStatus: order.financialStatus,
                fulfillmentStatus: normalizeFulfillmentStatus(order.fulfillmentStatus),
                fulfillmentStatusDisplay: toVendorDisplayStatus(order.fulfillmentStatus),
                trackingNumber: (order as unknown as { trackingNumber?: string | null }).trackingNumber,
                trackingCompany: (order as unknown as { trackingCompany?: string | null }).trackingCompany,
                trackingUrl: (order as unknown as { trackingUrl?: string | null }).trackingUrl,
                createdAt: order.shopifyCreatedAt || order.createdAt,
                lineItems,
                customer,
                shippingAddress,
                billingAddress,
                store: order.store,
            },
        })
    } catch (error) {
        console.error("[SUPPLIER_ORDER_GET]", error)
        return NextResponse.json({ message: "Failed to fetch order" }, { status: 500 })
    }
}

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ orderId: string }> },
) {
    try {
        const session = await auth()
        if (!session?.user?.id || session.user.role !== "SUPPLIER") {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }
        const { orderId } = await params
        const body = await req.json()

        const fulfillmentStatus = normalizeFulfillmentStatus(body.fulfillmentStatus)

        const trackingNumber = String(body.trackingNumber || "").trim() || null
        const trackingCompany = String(body.trackingCompany || "").trim() || null
        const trackingUrl = String(body.trackingUrl || "").trim() || null

        const ctx = await getSupplierContext(session.user.id)
        if (!ctx) {
            return NextResponse.json({ message: "Supplier profile not found" }, { status: 404 })
        }

        const order = await prisma.cachedOrder.findFirst({
            where: { shopifyOrderId: orderId },
            select: { id: true, storeId: true, lineItems: true },
        })
        if (!order) return NextResponse.json({ message: "Order not found" }, { status: 404 })
        if (!isSupplierAllowedForOrder(ctx.syncsByStore, order.storeId, order.lineItems)) {
            return NextResponse.json({ message: "Order not accessible" }, { status: 403 })
        }

        const updated = await prisma.cachedOrder.update({
            where: { id: order.id },
            data: {
                fulfillmentStatus,
                trackingNumber,
                trackingCompany,
                trackingUrl,
                pendingVendorSync: true,
                lastSupplierUpdateAt: new Date(),
                lastSupplierUpdatedBy: session.user.id,
                lastShopifySyncError: null,
            } as unknown as Record<string, unknown>,
            select: {
                shopifyOrderId: true,
                fulfillmentStatus: true,
            },
        })

        const shopifySync = await syncOrderToShopify(
            order.storeId,
            orderId,
            fulfillmentStatus,
            trackingNumber,
            trackingCompany,
            trackingUrl,
        )

        if (shopifySync.ok) {
            await prisma.cachedOrder.update({
                where: { id: order.id },
                data: {
                    pendingVendorSync: false,
                    lastShopifySyncAt: new Date(),
                    lastShopifySyncError: null,
                } as unknown as Record<string, unknown>,
            })
        } else {
            await prisma.cachedOrder.update({
                where: { id: order.id },
                data: {
                    pendingVendorSync: true,
                    lastShopifySyncError: shopifySync.error || "Unknown sync error",
                } as unknown as Record<string, unknown>,
            })
        }

        return NextResponse.json({
            order: {
                ...updated,
                trackingNumber,
                trackingCompany,
                trackingUrl,
                pendingVendorSync: !shopifySync.ok,
                lastShopifySyncError: shopifySync.ok ? null : shopifySync.error || "Unknown sync error",
                fulfillmentStatusDisplay: toVendorDisplayStatus(updated.fulfillmentStatus),
            },
        })
    } catch (error) {
        console.error("[SUPPLIER_ORDER_PATCH]", error)
        return NextResponse.json({ message: "Failed to update order" }, { status: 500 })
    }
}

