#!/usr/bin/env tsx
/**
 * Insert demo CachedOrder rows for Gmail AI / dashboard demos.
 *
 * Orders are matched by customer email + active store — use the SAME email you send from in Gmail tests.
 *
 * Usage:
 *   npx tsx scripts/seed-demo-cached-orders.ts
 *   SEED_STORE_ID=clxxx npx tsx scripts/seed-demo-cached-orders.ts
 *   DEMO_CUSTOMER_EMAIL=talatcloud@gmail.com npx tsx scripts/seed-demo-cached-orders.ts
 */
import "dotenv/config"
import { prisma } from "../src/lib/prisma"
import { logger } from "../src/lib/logger"

const DEMO_EMAIL =
    process.env.DEMO_CUSTOMER_EMAIL?.trim().toLowerCase() || "talatcloud@gmail.com"

async function main() {
    const explicitStoreId = process.env.SEED_STORE_ID?.trim()
    const store = explicitStoreId
        ? await prisma.store.findUnique({ where: { id: explicitStoreId }, select: { id: true, businessName: true } })
        : await prisma.store.findFirst({
              where: { isActive: true },
              select: { id: true, businessName: true },
              orderBy: { updatedAt: "desc" },
          })

    if (!store) {
        throw new Error(
            "No store found. Set SEED_STORE_ID or ensure at least one Store exists (ideally isActive: true).",
        )
    }

    logger.info(`Seeding demo CachedOrder for storeId=${store.id} (${store.businessName}) customerEmail=${DEMO_EMAIL}`)

    const now = new Date()
    const lineItemsSample = [
        {
            id: 9001,
            product_id: 7001,
            name: "JUNO Demo Tee",
            title: "JUNO Demo Tee",
            quantity: 1,
            price: "29.99",
        },
        {
            id: 9002,
            product_id: 7002,
            name: "Sticker Pack",
            title: "Sticker Pack",
            quantity: 2,
            price: "9.50",
        },
    ]

    const demos: Array<{
        shopifyOrderId: string
        orderNumber: string
        email: string
        totalPrice: string
        currency: string
        financialStatus: string
        fulfillmentStatus: string
        lineItems: unknown
        customer: unknown
        shopifyCreatedAt: Date
    }> = [
        {
            shopifyOrderId: "demo-shopify-1002",
            orderNumber: "#1002",
            email: DEMO_EMAIL,
            totalPrice: "49.99",
            currency: "USD",
            financialStatus: "paid",
            fulfillmentStatus: "fulfilled",
            lineItems: lineItemsSample,
            customer: {
                first_name: "Talat",
                last_name: "Cloud",
                email: DEMO_EMAIL,
            },
            shopifyCreatedAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
        },
        {
            shopifyOrderId: "demo-shopify-1001",
            orderNumber: "#1001",
            email: DEMO_EMAIL,
            totalPrice: "19.00",
            currency: "USD",
            financialStatus: "paid",
            fulfillmentStatus: "shipped",
            lineItems: [
                {
                    id: 8999,
                    product_id: 7000,
                    name: "Welcome Kit",
                    title: "Welcome Kit",
                    quantity: 1,
                    price: "19.00",
                },
            ],
            customer: {
                first_name: "Talat",
                last_name: "Cloud",
                email: DEMO_EMAIL,
            },
            shopifyCreatedAt: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
        },
        {
            shopifyOrderId: "demo-shopify-1003",
            orderNumber: "#1003",
            email: DEMO_EMAIL,
            totalPrice: "0.00",
            currency: "USD",
            financialStatus: "pending",
            fulfillmentStatus: "unfulfilled",
            lineItems: [
                {
                    id: 9010,
                    product_id: 7010,
                    name: "Pre-order Item",
                    title: "Pre-order Item",
                    quantity: 1,
                    price: "0.00",
                },
            ],
            customer: { first_name: "Talat", last_name: "Cloud", email: DEMO_EMAIL },
            shopifyCreatedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
        },
    ]

    for (const row of demos) {
        await prisma.cachedOrder.upsert({
            where: {
                shopifyOrderId_storeId: {
                    shopifyOrderId: row.shopifyOrderId,
                    storeId: store.id,
                },
            },
            create: {
                shopifyOrderId: row.shopifyOrderId,
                storeId: store.id,
                orderNumber: row.orderNumber,
                email: row.email,
                totalPrice: row.totalPrice,
                currency: row.currency,
                financialStatus: row.financialStatus,
                fulfillmentStatus: row.fulfillmentStatus,
                lineItems: row.lineItems as never,
                customer: row.customer as never,
                shopifyCreatedAt: row.shopifyCreatedAt,
            },
            update: {
                orderNumber: row.orderNumber,
                email: row.email,
                totalPrice: row.totalPrice,
                currency: row.currency,
                financialStatus: row.financialStatus,
                fulfillmentStatus: row.fulfillmentStatus,
                lineItems: row.lineItems as never,
                customer: row.customer as never,
                shopifyCreatedAt: row.shopifyCreatedAt,
                lastSyncedAt: new Date(),
            },
        })
        logger.info(`Upserted CachedOrder ${row.orderNumber} (${row.shopifyOrderId})`)
    }

    logger.info("Done. Reminder: Gmail auto-reply only loads orders for the ACTIVE store and matches CachedOrder.email to the sender.")
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
