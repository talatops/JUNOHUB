import { auth } from "@/auth"
import { isVendorPortalRole } from "@/lib/auth-roles"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { logger } from "@/lib/logger"
import { onboardingShopifySchema, validationErrorResponse } from "@/lib/api-schemas"

export async function POST(req: Request) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }
        if (!isVendorPortalRole(session.user.role)) {
            return NextResponse.json(
                { message: "Only vendor accounts can connect Shopify stores." },
                { status: 403 }
            )
        }

        const raw = await req.json().catch(() => ({}))
        const parsed = onboardingShopifySchema.safeParse(raw)
        if (!parsed.success) {
            return validationErrorResponse(parsed.error)
        }
        const { businessName, storeName, domain, apiKey, apiSecret, accessToken } = parsed.data

        // Multi-store: create a new store; set as active if first store
        const existingCount = await prisma.store.count({ where: { userId: session.user.id } })
        const isFirstStore = existingCount === 0

        // Clean domain: remove protocol, trailing slashes, and trim whitespace
        const cleanDomain = domain.trim().replace(/^https?:\/\//, "").replace(/\/$/, "").trim()

        const store = await prisma.store.create({
            data: {
                userId: session.user.id,
                businessName,
                email: session.user.email || "",
                timezone: "UTC",
                country: "US",
                shopifyStoreName: storeName,
                shopifyDomain: cleanDomain,
                shopifyApiKey: apiKey,
                shopifyApiSecret: apiSecret,
                shopifyAccessToken: accessToken,
                onboardingComplete: true,
                isActive: isFirstStore,
            },
        })

        if (isFirstStore) {
            await prisma.user.update({
                where: { id: session.user.id },
                data: { activeStoreId: store.id },
            })
        }

        // Register webhooks for the new store
        const appUrl = process.env.NEXTAUTH_URL || "https://your-tunnel-url.ngrok-free.app"
        const webhookTopics = ["orders/create", "orders/updated", "products/create", "products/update", "products/delete"]
        const webhookAddress = `${appUrl}/api/webhooks/shopify`

        // First, check existing webhooks to avoid duplicates
        let existingWebhooks: Array<{ topic: string; id: number; address: string }> = []
        try {
            const listResponse = await fetch(`https://${cleanDomain}/admin/api/2024-01/webhooks.json`, {
                headers: {
                    "X-Shopify-Access-Token": accessToken,
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
            logger.warn(`Could not fetch existing webhooks for store ${store.id}`, err)
        }

        for (const topic of webhookTopics) {
            try {
                // Check if webhook already exists with same address
                const existingWebhook = existingWebhooks.find(
                    (wh) => wh.topic === topic && wh.address === webhookAddress
                )

                if (existingWebhook) {
                    logger.info(`Webhook ${topic} already exists for address ${webhookAddress}, skipping registration`)
                    continue
                }

                const response = await fetch(`https://${cleanDomain}/admin/api/2024-01/webhooks.json`, {
                    method: "POST",
                    headers: {
                        "X-Shopify-Access-Token": accessToken,
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
                    logger.info(`Registered webhook: ${topic} for store ${store.id}`)
                } else {
                    const errorData = await response.json().catch(() => ({}))
                    // Handle "already taken" error gracefully - webhook exists and will work
                    if (errorData.errors?.address?.some((msg: string) => msg.includes("already been taken"))) {
                        logger.info(`Webhook ${topic} already registered for address ${webhookAddress}, continuing`)
                    } else {
                        logger.error(`Failed to register webhook ${topic}`, errorData)
                    }
                }
            } catch (err) {
                logger.error(`Error registering webhook ${topic}`, err)
            }
        }

        return NextResponse.json({ message: "Store onboarded successfully", store }, { status: 200 })
    } catch (error) {
        console.error("Onboarding error:", error)
        return NextResponse.json({ message: "Internal server error" }, { status: 500 })
    }
}
