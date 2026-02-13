import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"

export async function POST(req: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        const body = await req.json()
        const {
            businessName,
            businessEmail,
            country,
            timezone,
            storeName,
            domain,
            apiKey,
            apiSecret,
            accessToken
        } = body

        // Validate required fields
        if (!businessName || !domain || !accessToken) {
            return NextResponse.json({ message: "Missing required onboarding data." }, { status: 400 })
        }

        // Clean domain: remove protocol, trailing slashes, and trim whitespace
        const cleanDomain = domain.trim().replace(/^https?:\/\//, "").replace(/\/$/, "").trim()

        // Multi-store: find store by user + domain, then update or create
        let store = await prisma.store.findFirst({
            where: { userId: session.user.id, shopifyDomain: cleanDomain },
        })

        if (store) {
            store = await prisma.store.update({
                where: { id: store.id },
                data: {
                    businessName,
                    email: businessEmail ?? store.email,
                    country: country ?? store.country,
                    timezone: timezone ?? store.timezone,
                    shopifyStoreName: storeName ?? store.shopifyStoreName,
                    shopifyDomain: cleanDomain,
                    shopifyApiKey: apiKey ?? store.shopifyApiKey,
                    shopifyApiSecret: apiSecret ?? store.shopifyApiSecret,
                    shopifyAccessToken: accessToken,
                    onboardingComplete: true,
                },
            })
        } else {
            const existingCount = await prisma.store.count({ where: { userId: session.user.id } })
            store = await prisma.store.create({
                data: {
                    userId: session.user.id,
                    businessName,
                    email: businessEmail || session.user.email || "",
                    country: country || "US",
                    timezone: timezone || "UTC",
                    shopifyStoreName: storeName || "",
                    shopifyDomain: cleanDomain,
                    shopifyApiKey: apiKey || "",
                    shopifyApiSecret: apiSecret || "",
                    shopifyAccessToken: accessToken,
                    onboardingComplete: true,
                    isActive: existingCount === 0,
                },
            })
            if (existingCount === 0) {
                await prisma.user.update({
                    where: { id: session.user.id },
                    data: { activeStoreId: store.id },
                })
            }
        }

        // Register Webhooks with Shopify
        const appUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL || "https://your-tunnel-url.ngrok-free.app"
        const webhookTopics = ["orders/create", "orders/updated", "products/create", "products/update", "products/delete"]

        for (const topic of webhookTopics) {
            try {
                const controller = new AbortController()
                const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout
                
                const response = await fetch(`https://${cleanDomain}/admin/api/2024-01/webhooks.json`, {
                    method: "POST",
                    headers: {
                        "X-Shopify-Access-Token": accessToken,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        webhook: {
                            topic,
                            address: `${appUrl}/api/webhooks/shopify`,
                            format: "json"
                        }
                    }),
                    signal: controller.signal
                })
                
                clearTimeout(timeoutId)
                
                if (!response.ok) {
                    const errorText = await response.text().catch(() => "")
                    logger.warn(`Webhook ${topic} registration returned ${response.status}: ${errorText}`)
                } else {
                    logger.info(`Registered Shopify webhook: ${topic}`)
                }
            } catch (err) {
                if (err instanceof Error && err.name === 'AbortError') {
                    logger.error(`Webhook ${topic} registration timed out`)
                } else {
                    logger.error(`Failed to register webhook ${topic}`, err)
                }
            }
        }

        return NextResponse.json({
            message: "Onboarding completed and automation registered!",
            store
        })

    } catch (error) {
        logger.error("Onboarding completion error:", error)
        return NextResponse.json({ message: "Internal server error while saving data." }, { status: 500 })
    }
}
