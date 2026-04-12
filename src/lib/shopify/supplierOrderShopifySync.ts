import { prisma } from "@/lib/prisma"
import type { CanonicalFulfillmentStatus } from "@/lib/orders/fulfillmentStatus"
import type { SupplierHoldReasonCode } from "@/lib/orders/supplierHoldReasons"
import { clearOnHoldOnShopify, pushOnHoldToShopify } from "@/lib/shopify/orderHoldSync"
import { syncOrderFulfillmentToShopify } from "@/lib/shopify/supplierOrderFulfillmentSync"

export async function runSupplierOrderShopifySync(params: {
    storeId: string
    shopifyOrderId: string
    previousCanonical: CanonicalFulfillmentStatus
    newCanonical: CanonicalFulfillmentStatus
    trackingNumber: string | null
    trackingCompany: string | null
    trackingUrl: string | null
    holdCode: SupplierHoldReasonCode | null
    holdNote: string | null
}): Promise<{ ok: boolean; error?: string }> {
    const store = await prisma.store.findUnique({
        where: { id: params.storeId },
        select: { shopifyDomain: true, shopifyAccessToken: true },
    })
    if (!store?.shopifyDomain || !store?.shopifyAccessToken) {
        return { ok: false, error: "Shopify store not connected." }
    }
    const cleanDomain = store.shopifyDomain.trim().replace(/^https?:\/\//, "").replace(/\/$/, "")
    const accessToken = store.shopifyAccessToken

    if (params.newCanonical === "ON_HOLD") {
        if (!params.holdCode) {
            return { ok: false, error: "Hold reason is required for On hold status." }
        }
        return pushOnHoldToShopify({
            cleanDomain,
            accessToken,
            shopifyOrderId: params.shopifyOrderId,
            code: params.holdCode,
            note: params.holdNote,
        })
    }

    if (params.previousCanonical === "ON_HOLD") {
        const cleared = await clearOnHoldOnShopify({
            cleanDomain,
            accessToken,
            shopifyOrderId: params.shopifyOrderId,
        })
        if (!cleared.ok) return cleared
    }

    if (params.newCanonical === "SHIPPED" || params.newCanonical === "FULFILLED") {
        return syncOrderFulfillmentToShopify(
            params.storeId,
            params.shopifyOrderId,
            params.newCanonical,
            params.trackingNumber,
            params.trackingCompany,
            params.trackingUrl,
        )
    }

    return { ok: true }
}
