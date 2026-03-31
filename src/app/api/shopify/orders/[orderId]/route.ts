import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { handleApiError } from "@/lib/errors"
import { normalizeFulfillmentStatus, toVendorDisplayStatus } from "@/lib/orders/fulfillmentStatus"

export async function GET(
    request: Request,
    { params }: { params: Promise<{ orderId: string }> }
) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        const { orderId } = await params

        const store = await prisma.store.findFirst({
            where: { userId: session.user.id, isActive: true }
        })

        if (!store || !store.shopifyAccessToken || !store.shopifyDomain) {
            return NextResponse.json({ message: "Shopify store not connected." }, { status: 400 })
        }

        const cleanDomain = store.shopifyDomain.trim().replace(/^https?:\/\//, "").replace(/\/$/, "").trim()

        if (!cleanDomain) {
            return NextResponse.json({ message: "Invalid Shopify domain configured." }, { status: 400 })
        }

        // Fetch order from Shopify
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 30000)

        try {
            const response = await fetch(
                `https://${cleanDomain}/admin/api/2024-01/orders/${orderId}.json`,
                {
                    method: "GET",
                    headers: {
                        "X-Shopify-Access-Token": store.shopifyAccessToken,
                        "Content-Type": "application/json"
                    },
                    signal: controller.signal
                }
            )
            clearTimeout(timeoutId)

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: "Unknown error" }))
                return NextResponse.json({
                    message: "Failed to fetch order from Shopify.",
                    details: errorData
                }, { status: response.status })
            }

            const data = (await response.json()) as { order?: Record<string, unknown> }
            const order = data.order
            if (!order) {
                return NextResponse.json({ message: "Invalid order payload from Shopify." }, { status: 502 })
            }

            // Shopify sometimes omits email/customer; overlay CachedOrder when present (same as Gmail cache).
            const cached = await prisma.cachedOrder.findUnique({
                where: {
                    shopifyOrderId_storeId: {
                        shopifyOrderId: String(orderId),
                        storeId: store.id,
                    },
                },
                select: {
                    email: true,
                    customer: true,
                    fulfillmentStatus: true,
                    trackingNumber: true,
                    trackingCompany: true,
                    trackingUrl: true,
                    pendingVendorSync: true,
                    lastSupplierUpdateAt: true,
                    lastShopifySyncAt: true,
                    lastShopifySyncError: true,
                },
            })

            if (cached) {
                const cachedEmail = cached.email?.trim() || ""
                const shopifyEmail = typeof order.email === "string" ? order.email.trim() : ""
                if (!shopifyEmail && cachedEmail) {
                    order.email = cachedEmail
                }

                const cust = order.customer as Record<string, unknown> | null | undefined
                const cachedCust =
                    cached.customer &&
                    typeof cached.customer === "object" &&
                    cached.customer !== null &&
                    !Array.isArray(cached.customer)
                        ? (cached.customer as Record<string, unknown>)
                        : null

                if (!cust && cachedCust) {
                    order.customer = cachedCust
                } else if (cust && cachedEmail) {
                    const nested = typeof cust.email === "string" ? cust.email.trim() : ""
                    if (!nested) {
                        order.customer = { ...cust, email: cachedEmail }
                    }
                }

                order.fulfillment_status = toVendorDisplayStatus(cached.fulfillmentStatus)
                order.fulfillment_status_canonical = normalizeFulfillmentStatus(cached.fulfillmentStatus)
                order.tracking_number = cached.trackingNumber || null
                order.tracking_company = cached.trackingCompany || null
                order.tracking_url = cached.trackingUrl || null
                order.pending_vendor_sync = cached.pendingVendorSync
                order.last_supplier_update_at = cached.lastSupplierUpdateAt?.toISOString() || null
                order.last_shopify_sync_at = cached.lastShopifySyncAt?.toISOString() || null
                order.last_shopify_sync_error = cached.lastShopifySyncError || null
            }

            return NextResponse.json({ order })
        } catch (fetchError: unknown) {
            clearTimeout(timeoutId)
            if (fetchError instanceof Error && fetchError.name === "AbortError") {
                return NextResponse.json({
                    message: "Request timeout.",
                    error: "TIMEOUT"
                }, { status: 504 })
            }
            throw fetchError
        }

    } catch (error: unknown) {
        return handleApiError(error, "fetch-order")
    }
}
