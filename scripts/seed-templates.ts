#!/usr/bin/env tsx
/**
 * Seed script for predefined JUNO email templates.
 *
 * Usage:
 *   tsx scripts/seed-templates.ts
 *
 * Behaviour:
 * - Finds a target store:
 *   - If SEED_STORE_ID is set, uses that storeId
 *   - Otherwise, uses the first active store it can find
 * - Inserts a small library of templates for common intents/moods
 * - Idempotent: skips creating a template if one with the same
 *   (storeId, intent, mood, name) already exists.
 */

import { prisma } from "../src/lib/prisma"
import { logger } from "../src/lib/logger"
import { randomUUID } from "crypto"

type SeedTemplate = {
    name: string
    intent: string
    mood: string
    description: string
    body: string
}

const SEED_TEMPLATES: SeedTemplate[] = [
    // Shipping delay - angry customer
    {
        name: "Shipping delay – angry customer",
        intent: "shipping_delay",
        mood: "angry",
        description:
            "Apology and clear acknowledgement for an angry customer asking where their order is.",
        body: `Hi {{customer_name}},

I'm really sorry for the frustration here. I can see why you'd be upset, and I appreciate you taking the time to reach out.

We've reviewed your message and we're looking into the status of your order right away. {{ticket_summary}}

As soon as we have an updated timeline from our shipping partner, we'll follow up with you by email. If you have any extra details you think might help, you can reply directly to this message.

Thank you for your patience while we sort this out.

Best regards,
{{store_name}} Support Team`,
    },
    // Shipping delay - confused / neutral customer
    {
        name: "Shipping delay – confused customer",
        intent: "shipping_delay",
        mood: "confused",
        description:
            "Reassuring response for a customer who is unsure where their order is.",
        body: `Hi {{customer_name}},

Thanks for reaching out about your order – I’m glad you checked in.

We’ve received your message and we’re reviewing your order details now. {{ticket_summary}}

We’re confirming the latest tracking information with our shipping partner and will follow up with an update as soon as we have it. In the meantime, if you notice any changes or receive a new tracking email, feel free to reply here so we can keep everything in one place.

Best regards,
{{store_name}} Support Team`,
    },
    // Refund / return request – neutral
    {
        name: "Refund or return – neutral",
        intent: "refund_request",
        mood: "neutral",
        description:
            "Professional acknowledgement of a refund/return request with next steps.",
        body: `Hi {{customer_name}},

Thank you for contacting us about your refund/return request.

We’ve reviewed your message and we’re now looking into the order details so we can process this correctly. {{ticket_summary}}

In some cases we may need a bit more information (for example photos of the item or confirmation of the order number). If that’s needed, we’ll reply back with a short checklist so you know exactly what to send.

Once everything is confirmed, we’ll process your refund/return and email you a final confirmation.

Best regards,
{{store_name}} Support Team`,
    },
    // Refund / return request – appreciative / happy
    {
        name: "Refund or return – polite customer",
        intent: "refund_request",
        mood: "happy",
        description:
            "Warm, appreciative reply when the customer is polite and reasonable about a refund/return.",
        body: `Hi {{customer_name}},

Thank you for your thoughtful message – we really appreciate how clearly you explained the situation.

We’ve started reviewing your request and the details of your order. {{ticket_summary}}

If we need anything else from you (for example photos or a bit more context), we’ll let you know right away. Otherwise, we’ll process your refund/return and follow up with a confirmation email as soon as it’s completed.

Thank you again for shopping with {{store_name}}.

Warm regards,
{{store_name}} Support Team`,
    },
    // Product question / general support – neutral
    {
        name: "Product question – we’re checking",
        intent: "question",
        mood: "neutral",
        description:
            "Neutral response letting the customer know their product question is being reviewed.",
        body: `Hi {{customer_name}},

Thanks for reaching out with your question – we’re glad you asked.

We’ve received your message and we’re checking the details so we can give you a clear answer. {{ticket_summary}}

As soon as we’ve confirmed everything with the relevant team, we’ll follow up with a detailed reply. If you have any extra information or screenshots that might help, you can reply to this email and they’ll be added to your ticket.

Best regards,
{{store_name}} Support Team`,
    },
    // Product question – confused customer
    {
        name: "Product question – confused customer",
        intent: "question",
        mood: "confused",
        description:
            "Reassuring answer for a customer who is confused about how something works.",
        body: `Hi {{customer_name}},

Thank you for reaching out and for explaining what’s been confusing – you’re not alone, and we’re here to help.

We’ve received your message and we’re reviewing the details so we can walk you through this step by step. {{ticket_summary}}

Once we’ve double-checked everything, we’ll follow up with a clear explanation and, if helpful, some simple steps you can follow. If you have any screenshots or additional details, feel free to reply to this email so we can see exactly what you’re seeing.

Warm regards,
{{store_name}} Support Team`,
    },
    // Account / billing issue – frustrated customer
    {
        name: "Account or billing – concerned customer",
        intent: "account_billing",
        mood: "angry",
        description:
            "Empathetic response when a customer is upset about a billing or account issue.",
        body: `Hi {{customer_name}},

I’m really sorry for the worry and frustration this billing issue has caused – I completely understand how important this is.

We’ve received your message and we’re reviewing your account and recent charges as a priority. {{ticket_summary}}

If we need any additional details to resolve this, we’ll let you know exactly what we need and why. Otherwise, we’ll follow up as soon as we have a full explanation and next steps for you.

Thank you for your patience while we get to the bottom of this.

Best regards,
{{store_name}} Support Team`,
    },
    // Account / billing issue – neutral
    {
        name: "Account or billing – investigation",
        intent: "account_billing",
        mood: "neutral",
        description:
            "Calm, neutral response acknowledging an account or billing question and starting an investigation.",
        body: `Hi {{customer_name}},

Thanks for getting in touch about your account/billing question.

We’ve received your message and we’re reviewing your account details and recent activity. {{ticket_summary}}

If we need any additional information from you, we’ll reply with a short list so it’s easy to provide. Once we’ve completed our review, we’ll follow up with a clear explanation of what we found and, if needed, any adjustments we’ll make.

Best regards,
{{store_name}} Support Team`,
    },
    // Thank-you / positive feedback – happy customer
    {
        name: "Thank-you – happy customer",
        intent: "general",
        mood: "happy",
        description:
            "Warm reply to a customer who sends positive feedback or a thank-you message.",
        body: `Hi {{customer_name}},

Thank you so much for your kind message – it truly made our day here at {{store_name}}.

We really appreciate you taking the time to share your experience. {{ticket_summary}}

If there’s ever anything else we can help with, just reply to this email and we’ll be glad to assist.

Warm regards,
{{store_name}} Support Team`,
    },
]

async function getTargetStoreId(): Promise<string> {
    const explicitId = process.env.SEED_STORE_ID
    if (explicitId) {
        const store = await prisma.store.findUnique({
            where: { id: explicitId },
            select: { id: true },
        })
        if (!store) {
            throw new Error(`SEED_STORE_ID is set, but no store found with id=${explicitId}`)
        }
        return store.id
    }

    const store = await prisma.store.findFirst({
        where: { isActive: true },
        select: { id: true },
    })

    if (!store) {
        throw new Error(
            "No active store found. Set SEED_STORE_ID to a valid store id before running this script.",
        )
    }

    return store.id
}

async function seedTemplates() {
    try {
        logger.info("Starting template seeding...")

        const storeId = await getTargetStoreId()
        logger.info(`Seeding templates for storeId=${storeId}`)

        for (const tpl of SEED_TEMPLATES) {
            // Check if a template with the same (storeId, intent, mood, name) already exists
            const existing = await prisma.$queryRaw<
                { id: string }[]
            >`
                SELECT "id"
                FROM "Template"
                WHERE "storeId" = ${storeId}
                  AND "intent" = ${tpl.intent}
                  AND "mood" = ${tpl.mood}
                  AND "name" = ${tpl.name}
                LIMIT 1
            `

            if (existing.length > 0) {
                logger.info(
                    `Skipping existing template: "${tpl.name}" (intent=${tpl.intent}, mood=${tpl.mood})`,
                )
                continue
            }

            const id = randomUUID()

            await prisma.$executeRaw`
                INSERT INTO "Template"
                    ("id", "storeId", "name", "intent", "mood", "description", "body", "variables", "isHtml", "createdAt", "updatedAt")
                VALUES
                    (${id}, ${storeId}, ${tpl.name}, ${tpl.intent}, ${tpl.mood}, ${tpl.description}, ${tpl.body}, NULL, FALSE, NOW(), NOW())
            `

            logger.info(
                `Inserted template: "${tpl.name}" (intent=${tpl.intent}, mood=${tpl.mood})`,
            )
        }

        logger.info("Template seeding completed.")
    } catch (error) {
        logger.error("Template seeding failed:", error)
        process.exit(1)
    } finally {
        await prisma.$disconnect()
    }
}

if (require.main === module) {
    seedTemplates()
        .then(() => {
            logger.info("Seed script finished successfully.")
            process.exit(0)
        })
        .catch((error) => {
            logger.error("Seed script encountered an error:", error)
            process.exit(1)
        })
}

