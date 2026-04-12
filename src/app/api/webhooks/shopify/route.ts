import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { updateSingleProduct, updateSingleOrder } from "@/lib/cache"
import { evaluateLowStockAfterProductWebhook } from "@/lib/automation/lowStock"
import { autoLinkOfferToShopifyProduct } from "@/lib/products/autoLinkOfferToShopifyProduct"
import crypto from "crypto"
import { logger } from "@/lib/logger"

// Ensure raw body is available for HMAC verification
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Verify Shopify webhook HMAC signature
 */
function verifyWebhook(hmac: string, body: string, secret: string): boolean {
    const hash = crypto
        .createHmac("sha256", secret)
        .update(body, "utf8")
        .digest("base64")
    return hash === hmac
}

export async function POST(req: NextRequest) {
    try {
        const hmac = req.headers.get("x-shopify-hmac-sha256")
        const topic = req.headers.get("x-shopify-topic")
        const domain = req.headers.get("x-shopify-shop-domain")

        if (!hmac || !topic || !domain) {
            logger.error("[Webhook] Missing required headers")
            return new NextResponse("Missing Shopify headers", { status: 400 })
        }

        // Get raw body for HMAC verification
        const rawBody = await req.text()
        const body = JSON.parse(rawBody)

        logger.info(`[Shopify Webhook] Received ${topic} from ${domain}`)

        // Clean domain to match database format
        const cleanDomain = domain.trim().replace(/^https?:\/\//, "").replace(/\/$/, "").trim()

        // Find the store by domain
        let store = await prisma.store.findFirst({
            where: { shopifyDomain: cleanDomain }
        })

        if (!store) {
            store = await prisma.store.findFirst({
                where: { shopifyDomain: domain }
            })
        }

        if (!store) {
            logger.error(`[Webhook] Store not found for domain: ${domain}`)
            return new NextResponse("Store not found", { status: 404 })
        }

        // Verify HMAC signature
        if (!verifyWebhook(hmac, rawBody, store.shopifyApiSecret)) {
            logger.error(`[Webhook] HMAC verification failed for ${domain}`)
            return new NextResponse("Invalid signature", { status: 401 })
        }

        // Handle specific topics and update cache + sync metadata
        switch (topic) {
            case "orders/create":
            case "orders/updated":
                logger.info(`[Webhook] Processing order ${topic}: ${body.id}`)
                await updateSingleOrder(store.id, body)
                // Update sync metadata to invalidate cache
                await prisma.syncMetadata.upsert({
                    where: {
                        storeId_resourceType: {
                            storeId: store.id,
                            resourceType: "orders"
                        }
                    },
                    create: {
                        storeId: store.id,
                        resourceType: "orders",
                        lastSyncAt: new Date(),
                        syncStatus: "success",
                        recordCount: 1
                    },
                    update: {
                        lastSyncAt: new Date(),
                        syncStatus: "success"
                    }
                })
                break

            case "products/update":
            case "products/create":
                logger.info(`[Webhook] Processing product ${topic}: ${body.id}`)
                {
                    await updateSingleProduct(store.id, body)
                    evaluateLowStockAfterProductWebhook({
                        storeId: store.id,
                        shopifyProductBody: body,
                    }).catch((lowStockErr) => {
                        logger.error("[Webhook] lowStock evaluation failed", lowStockErr)
                    })
                }
                try {
                    const linkResult = await autoLinkOfferToShopifyProduct(store.id, body)
                    if (linkResult.linked) {
                        logger.info(`[Webhook] Auto-linked product to supplier offer`, {
                            storeId: store.id,
                            productSyncId: linkResult.productSyncId,
                            supplierId: linkResult.supplierId,
                        })
                    }
                } catch (autoLinkErr) {
                    logger.error("[Webhook] autoLinkOfferToShopifyProduct error (ignored)", autoLinkErr)
                }
                // Update sync metadata to invalidate cache
                await prisma.syncMetadata.upsert({
                    where: {
                        storeId_resourceType: {
                            storeId: store.id,
                            resourceType: "products"
                        }
                    },
                    create: {
                        storeId: store.id,
                        resourceType: "products",
                        lastSyncAt: new Date(),
                        syncStatus: "success",
                        recordCount: 1
                    },
                    update: {
                        lastSyncAt: new Date(),
                        syncStatus: "success"
                    }
                })
                break

            case "products/delete":
                logger.info(`[Webhook] Processing product deletion: ${body.id}`)
                await prisma.cachedProduct.deleteMany({
                    where: {
                        shopifyProductId: body.id.toString(),
                        storeId: store.id
                    }
                })
                // Update sync metadata
                await prisma.syncMetadata.upsert({
                    where: {
                        storeId_resourceType: {
                            storeId: store.id,
                            resourceType: "products"
                        }
                    },
                    create: {
                        storeId: store.id,
                        resourceType: "products",
                        lastSyncAt: new Date(),
                        syncStatus: "success"
                    },
                    update: {
                        lastSyncAt: new Date()
                    }
                })
                break

            default:
                logger.warn(`[Webhook] Unhandled topic: ${topic}`)
        }

        logger.info(`[Webhook] Successfully processed ${topic} for ${domain}`)
        return new NextResponse("OK", { status: 200 })

    } catch (error) {
        logger.error("[Webhook] Processing error:", error)
        return new NextResponse("Internal Server Error", { status: 500 })
    }
}
