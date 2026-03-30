import "dotenv/config"
import { prisma } from "@/lib/prisma"
import { insertTemplate } from "@/lib/juno/templatesRepo"

function requireEnv(name: string): string {
    const v = process.env[name]
    if (!v) throw new Error(`Missing required env var: ${name}`)
    return v
}

async function main() {
    // This relies on Prisma using DATABASE_URL from env.test (loaded by the runner script).
    // Create a minimal user + active store, plus a few templates and CachedOrder rows.
    const userEmail = process.env.TEST_VENDOR_EMAIL || "vendor@example.com"

    const user = await prisma.user.upsert({
        where: { email: userEmail },
        update: { role: "VENDOR" },
        create: {
            email: userEmail,
            role: "VENDOR",
        },
        select: { id: true },
    })

    const store = await prisma.store.upsert({
        where: { id: process.env.TEST_STORE_ID || "test-store" },
        update: {
            userId: user.id,
            isActive: true,
            businessName: process.env.TEST_STORE_NAME || "YOUR_STORE",
            email: process.env.TEST_STORE_EMAIL || "support@yourstore.test",
            timezone: "UTC",
            country: "US",
            shopifyStoreName: "test",
            shopifyDomain: "test.myshopify.com",
            shopifyApiKey: "test",
            shopifyApiSecret: "test",
            shopifyAccessToken: "test",
        },
        create: {
            id: process.env.TEST_STORE_ID || "test-store",
            userId: user.id,
            isActive: true,
            businessName: process.env.TEST_STORE_NAME || "YOUR_STORE",
            email: process.env.TEST_STORE_EMAIL || "support@yourstore.test",
            timezone: "UTC",
            country: "US",
            shopifyStoreName: "test",
            shopifyDomain: "test.myshopify.com",
            shopifyApiKey: "test",
            shopifyApiSecret: "test",
            shopifyAccessToken: "test",
        },
        select: { id: true },
    })

    // Ensure the app logic sees an active store for the user.
    await prisma.user.update({
        where: { id: user.id },
        data: { activeStoreId: store.id },
    })

    // Minimal templates so we get stable rendering without requiring a full catalog.
    // These templates reference {{ticket_summary}} and {{order_summary}}.
    const templateBody = `
<div>
  <p>Hello {{customer_name}},</p>
  <p>{{ticket_summary}}</p>
  <p>{{order_summary}}</p>
  <p>— {{store_name}} Support</p>
</div>
`.trim()

    const intents = [
        ["general", "neutral"],
        ["general", "happy"],
        ["shipping_delay", "neutral"],
        ["refund_request", "neutral"],
        ["account_billing", "neutral"],
        ["question", "neutral"],
        ["off_topic", "neutral"],
    ] as const

    for (const [intent, mood] of intents) {
        await insertTemplate({
            storeId: store.id,
            name: `Test template — ${intent}/${mood}`,
            intent,
            mood,
            description: "Test harness template",
            body: templateBody,
            variables: { ticket_summary: true, order_summary: true },
            isHtml: true,
        }).catch(() => {
            // If duplicate-ish templates exist, ignore; findTemplateWithFallback selects latest.
        })
    }

    const customerEmail = process.env.TEST_CUSTOMER_EMAIL || "customer@gmail.com"

    const baseLineItems = [
        { title: "Hoodie", quantity: 1, product_id: 111 },
        { title: "Socks", quantity: 2, product_id: 222 },
    ]

    const now = new Date()

    const orders = [
        { orderNumber: "1002", shopifyOrderId: "gid://shopify/Order/1002", totalPrice: "49.99" },
        { orderNumber: "1003", shopifyOrderId: "gid://shopify/Order/1003", totalPrice: "19.99" },
    ]

    for (const o of orders) {
        await prisma.cachedOrder.upsert({
            where: {
                shopifyOrderId_storeId: {
                    shopifyOrderId: o.shopifyOrderId,
                    storeId: store.id,
                },
            },
            update: {
                orderNumber: o.orderNumber,
                email: customerEmail,
                totalPrice: o.totalPrice,
                currency: "USD",
                financialStatus: "paid",
                fulfillmentStatus: "unfulfilled",
                lineItems: baseLineItems as unknown as object,
                customer: { email: customerEmail } as unknown as object,
                shopifyCreatedAt: now,
                lastSyncedAt: now,
            },
            create: {
                shopifyOrderId: o.shopifyOrderId,
                storeId: store.id,
                orderNumber: o.orderNumber,
                email: customerEmail,
                totalPrice: o.totalPrice,
                currency: "USD",
                financialStatus: "paid",
                fulfillmentStatus: "unfulfilled",
                lineItems: baseLineItems as unknown as object,
                customer: { email: customerEmail } as unknown as object,
                shopifyCreatedAt: now,
                lastSyncedAt: now,
            },
        })
    }

    console.log(
        JSON.stringify(
            {
                ok: true,
                storeId: store.id,
                userEmail,
                customerEmail,
                seededOrders: orders.map((o) => o.orderNumber),
            },
            null,
            2,
        ),
    )
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })

