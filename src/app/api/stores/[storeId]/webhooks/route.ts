import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"

/**
 * POST /api/stores/[storeId]/webhooks
 * Register webhooks for a store
 */
export async function POST(
    request: Request,
    { params }: { params: Promise<{ storeId: string }> }
) {
    try {
        const session = await auth()

        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        const { storeId } = await params

        const store = await prisma.store.findFirst({
            where: {
                id: storeId,
                userId: session.user.id
            }
        })

        if (!store) {
            return NextResponse.json({ message: "Store not found" }, { status: 404 })
        }

        const appUrl = process.env.NEXTAUTH_URL || "https://your-tunnel-url.ngrok-free.app"
        const webhookTopics = ["orders/create", "orders/updated", "products/create", "products/update", "products/delete"]
        const cleanDomain = store.shopifyDomain.trim().replace(/^https?:\/\//, "").replace(/\/$/, "").trim()
        const webhookAddress = `${appUrl}/api/webhooks/shopify`

        const registered: string[] = []
        const failed: string[] = []

        // First, check existing webhooks to avoid duplicates
        let existingWebhooks: Array<{ topic: string; id: number; address: string }> = []
        try {
            const listResponse = await fetch(`https://${cleanDomain}/admin/api/2024-01/webhooks.json`, {
                headers: {
                    "X-Shopify-Access-Token": store.shopifyAccessToken,
                    "Content-Type": "application/json"
                }
            })
            if (listResponse.ok) {
                const webhooksData = await listResponse.json()
                existingWebhooks = (webhooksData.webhooks || []).map((wh: { topic: string; id: number; address: string }) => ({
                    topic: wh.topic,
                    id: wh.id,
                    address: wh.address
                }))
            }
        } catch (err) {
            logger.warn(`Could not fetch existing webhooks for store ${storeId}`, err)
        }

        for (const topic of webhookTopics) {
            try {
                // Check if webhook already exists with same address
                const existingWebhook = existingWebhooks.find(
                    (wh) => wh.topic === topic && wh.address === webhookAddress
                )

                if (existingWebhook) {
                    registered.push(topic)
                    logger.info(`Webhook ${topic} already exists for address ${webhookAddress}, skipping registration`)
                    continue
                }

                const response = await fetch(`https://${cleanDomain}/admin/api/2024-01/webhooks.json`, {
                    method: "POST",
                    headers: {
                        "X-Shopify-Access-Token": store.shopifyAccessToken,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        webhook: {
                            topic,
                            address: webhookAddress,
                            format: "json"
                        }
                    })
                })

                if (response.ok) {
                    registered.push(topic)
                    logger.info(`Registered webhook: ${topic} for store ${storeId}`)
                } else {
                    const errorData = await response.json().catch(() => ({}))
                    // Handle "already taken" error gracefully - webhook exists and will work
                    if (errorData.errors?.address?.some((msg: string) => msg.includes("already been taken"))) {
                        registered.push(topic)
                        logger.info(`Webhook ${topic} already registered for address ${webhookAddress}`)
                    } else {
                        logger.error(`Failed to register webhook ${topic}`, errorData)
                        failed.push(topic)
                    }
                }
            } catch (err) {
                logger.error(`Error registering webhook ${topic}`, err)
                failed.push(topic)
            }
        }

        return NextResponse.json({
            success: true,
            registered,
            failed,
            message: `Registered ${registered.length} webhook(s)${failed.length > 0 ? `, ${failed.length} failed` : ""}`
        })
    } catch (error) {
        logger.error("Error registering webhooks:", error)
        return NextResponse.json(
            { message: "Failed to register webhooks" },
            { status: 500 }
        )
    }
}
