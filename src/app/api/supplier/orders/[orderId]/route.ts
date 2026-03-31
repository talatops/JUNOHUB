import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

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
                fulfillmentStatus: order.fulfillmentStatus || "UNFULFILLED",
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

        const allowedStatuses = new Set(["UNFULFILLED", "IN_PROGRESS", "SHIPPED", "FULFILLED", "CANCELLED"])
        const fulfillmentStatus = String(body.fulfillmentStatus || "").toUpperCase()
        if (!allowedStatuses.has(fulfillmentStatus)) {
            return NextResponse.json({ message: "Invalid fulfillment status" }, { status: 400 })
        }

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
            } as unknown as Record<string, unknown>,
            select: {
                shopifyOrderId: true,
                fulfillmentStatus: true,
            },
        })

        return NextResponse.json({
            order: {
                ...updated,
                trackingNumber,
                trackingCompany,
                trackingUrl,
            },
        })
    } catch (error) {
        console.error("[SUPPLIER_ORDER_PATCH]", error)
        return NextResponse.json({ message: "Failed to update order" }, { status: 500 })
    }
}

