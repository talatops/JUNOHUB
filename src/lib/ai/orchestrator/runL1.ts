import { groqChatCompletion } from "@/lib/ai/groqClient"
import { logger } from "@/lib/logger"
import { getBlendedStorefrontContext } from "@/lib/storefront-chat/retrieval"
import { extractOrderNumberHints } from "@/lib/ai/gmailContext"
import {
    formatOrderCandidatesForPrompt,
    getOrderDetailForVerifiedEmail,
    listOrdersForCustomerEmail,
    orderNeedsDisambiguation,
} from "@/lib/ai/tools/orderTools"
import {
    getProductMetafieldsForL1,
    searchProductsForStore,
} from "@/lib/ai/tools/productTools"
import { isModuleEnabled, parseAiModulesJson } from "@/lib/ai/orchestrator/aiModules"
import { pillarForModule } from "@/lib/ai/orchestrator/manifests"
import { routeCustomerIntent } from "@/lib/ai/orchestrator/intentRouter"
import type { L1Channel, L1Module, L1RunMeta } from "@/lib/ai/orchestrator/types"

const GENERIC_NO_ORDER_EMAIL =
    "We could not find a recent order associated with this email address. If you placed an order, please contact us from the same email you used at checkout, or reply with your order number from your confirmation email."

const WIDGET_VERIFY_PROMPT =
    "To look up order details or account-specific information, please enter the email you used when placing your order. We will send you a one-time code to verify."

function isWidgetSessionValid(
    verifiedEmail: string | null | undefined,
    expiresAt: Date | null | undefined,
): boolean {
    if (!verifiedEmail?.trim()) return false
    if (!expiresAt) return false
    return expiresAt.getTime() > Date.now()
}

export type RunL1Input = {
    channel: L1Channel
    storeId: string
    storeName: string
    message: string
    history: Array<{ senderType?: "CUSTOMER" | "AI"; role?: string; content: string }>
    categoryMetadetailsEnabled: boolean
    aiModulesJson: unknown
    emailFrom?: string | null
    widgetVerifiedEmail?: string | null
    widgetSessionExpiresAt?: Date | null
    boundShopifyOrderId?: string | null
}

export type RunL1Result = {
    text: string
    meta: L1RunMeta
}

function historyToGroq(
    history: RunL1Input["history"],
): { role: "user" | "assistant"; content: string }[] {
    return history.slice(-8).map((m) => {
        if (m.senderType === "AI" || m.role === "assistant") {
            return { role: "assistant" as const, content: m.content }
        }
        return { role: "user" as const, content: m.content }
    })
}

async function composeReply(params: {
    storeName: string
    facts: string
    message: string
    history: { role: "user" | "assistant"; content: string }[]
}): Promise<string> {
    const system = [
        `You are the customer support assistant for ${params.storeName}.`,
        "Use ONLY information in the Facts section. If Facts are insufficient, say what is missing in one short sentence.",
        "Do not invent order numbers, tracking URLs, prices, or inventory counts not present in Facts.",
        "Be concise, friendly, and plain text (no markdown).",
    ].join(" ")

    const user = [`Facts:\n${params.facts}`, "", `Latest message:\n${params.message}`].join(
        "\n",
    )

    const messages: Parameters<typeof groqChatCompletion>[0] = [
        { role: "system", content: system },
        ...params.history,
        { role: "user", content: user },
    ]

    const out = await groqChatCompletion(messages, {
        temperature: 0.2,
        maxTokens: 500,
        timeoutMs: 28_000,
    })
    const text = (out.content || "").trim()
    if (!text) {
        return "Thanks for your message. Our team will get back to you shortly."
    }
    return text
}

function ticketHandoffText(module: L1Module, storeName: string): string {
    return [
        `Thanks for reaching out to ${storeName}.`,
        "I've passed your request to our team with the details you shared. A human will follow up by email with next steps.",
        "If you have not already, please include your order number and a brief description of the issue in your reply.",
    ].join(" ")
}

export async function runL1Orchestrator(input: RunL1Input): Promise<RunL1Result> {
    const modules = parseAiModulesJson(input.aiModulesJson)
    const retrieval = await getBlendedStorefrontContext({
        storeId: input.storeId,
        query: input.message,
    })
    const kbContext =
        retrieval.items.length > 0
            ? retrieval.items
                  .map((i, idx) => `[${idx + 1}] (${i.source}) ${i.title}: ${i.content}`)
                  .join("\n")
            : ""

    const routed = await routeCustomerIntent(input.message)
    let module: L1Module = routed.module
    if (!isModuleEnabled(modules, module)) {
        module = "FAQ"
    }

    const pillar = pillarForModule(module)
    const usedTools: string[] = []

    let customerEmail: string | null = null
    if (input.channel === "email") {
        customerEmail = input.emailFrom?.trim().toLowerCase() || null
    } else {
        if (isWidgetSessionValid(input.widgetVerifiedEmail, input.widgetSessionExpiresAt)) {
            customerEmail = input.widgetVerifiedEmail!.trim().toLowerCase()
        }
    }

    const needsFiber =
        pillar === "T" || pillar === "X" || module === "CATEGORY_METADETAILS"

    if (input.channel === "widget" && needsFiber && !customerEmail) {
        return {
            text: WIDGET_VERIFY_PROMPT,
            meta: {
                module,
                pillar,
                usedTools: [],
                kbHits: retrieval.kbCount,
                productHits: retrieval.productCount,
            },
        }
    }

    if (
        (pillar === "T" || pillar === "X") &&
        input.channel === "email" &&
        !customerEmail
    ) {
        return {
            text: GENERIC_NO_ORDER_EMAIL,
            meta: {
                module,
                pillar,
                usedTools,
                kbHits: retrieval.kbCount,
                productHits: retrieval.productCount,
            },
        }
    }

    const ordersForEmail = customerEmail
        ? await listOrdersForCustomerEmail(input.storeId, customerEmail)
        : []

    if (
        (pillar === "T" || pillar === "X") &&
        ordersForEmail.length === 0 &&
        customerEmail
    ) {
        const facts = [
            kbContext ? `Knowledge:\n${kbContext}` : "",
            "No orders on file for this email in our cache.",
        ]
            .filter(Boolean)
            .join("\n\n")
        if (pillar === "X") {
            return {
                text: ticketHandoffText(module, input.storeName),
                meta: {
                    module,
                    pillar,
                    usedTools: ["ticket_intake"],
                    kbHits: retrieval.kbCount,
                    productHits: retrieval.productCount,
                },
            }
        }
        const text = await composeReply({
            storeName: input.storeName,
            facts,
            message: input.message,
            history: historyToGroq(input.history),
        })
        return {
            text,
            meta: {
                module,
                pillar,
                usedTools,
                kbHits: retrieval.kbCount,
                productHits: retrieval.productCount,
            },
        }
    }

    if (pillar === "X" && ordersForEmail.length > 0) {
        return {
            text: ticketHandoffText(module, input.storeName),
            meta: {
                module,
                pillar,
                usedTools: ["ticket_intake"],
                kbHits: retrieval.kbCount,
                productHits: retrieval.productCount,
            },
        }
    }

    const hints = extractOrderNumberHints(input.message)
    const hintText =
        input.channel === "email"
            ? `${input.message}\n${(input.history || []).map((h) => h.content).join("\n")}`
            : input.message

    const disambiguate =
        customerEmail &&
        orderNeedsDisambiguation(customerEmail, hintText, ordersForEmail)

    if (
        (module === "ORDER_STATUS" ||
            module === "ORDER_SUMMARY" ||
            module === "SHIPPING_TRACKING") &&
        customerEmail &&
        disambiguate &&
        !input.boundShopifyOrderId
    ) {
        const list = formatOrderCandidatesForPrompt(ordersForEmail)
        return {
            text: `We found more than one order for your email. Which order do you mean?\n${list}\n\nReply with the order number (e.g. #1002).`,
            meta: {
                module,
                pillar,
                usedTools: ["list_orders"],
                kbHits: retrieval.kbCount,
                productHits: retrieval.productCount,
            },
        }
    }

    let orderFacts = ""
    if (
        customerEmail &&
        (module === "ORDER_STATUS" ||
            module === "ORDER_SUMMARY" ||
            module === "SHIPPING_TRACKING")
    ) {
        const detail = await getOrderDetailForVerifiedEmail(input.storeId, customerEmail, {
            shopifyOrderId: input.boundShopifyOrderId ?? undefined,
            orderNumberHint: hints[0],
        })
        usedTools.push("get_order_detail")
        if (detail) {
            orderFacts = [
                `Order ${detail.orderNumber} (${detail.shopifyOrderId})`,
                `Created: ${detail.shopifyCreatedAt ?? "unknown"}`,
                `Financial: ${detail.financialStatus ?? "unknown"}`,
                `Fulfillment: ${detail.fulfillmentStatus ?? "unknown"}`,
                `Total: ${detail.totalPrice} ${detail.currency ?? ""}`,
                detail.trackingNumber || detail.trackingUrl
                    ? `Tracking: ${detail.trackingCompany ?? ""} ${detail.trackingNumber ?? ""} ${detail.trackingUrl ?? ""}`.trim()
                    : "Tracking: not available in our cache yet.",
                `Line items (JSON): ${JSON.stringify(detail.lineItems).slice(0, 4000)}`,
            ].join("\n")
        } else {
            orderFacts =
                "Order detail could not be loaded (missing order reference or no match for this email)."
        }
    }

    let productFacts = ""
    if (
        module === "INVENTORY_STOCK" ||
        module === "CATEGORY_METADETAILS" ||
        module === "PRODUCT_FIT"
    ) {
        const hits = await searchProductsForStore(input.storeId, input.message, 5)
        usedTools.push("search_products")
        if (hits.length) {
            productFacts = hits
                .map(
                    (h) =>
                        `- ${h.title} (SKU ${h.sku ?? "n/a"}) | ${h.inventorySummary ?? "inventory n/a"}${h.metafieldsSummary ? ` | ${h.metafieldsSummary}` : ""}`,
                )
                .join("\n")
        }
        if (module === "CATEGORY_METADETAILS" && input.categoryMetadetailsEnabled && hits[0]) {
            const mf = await getProductMetafieldsForL1(
                input.storeId,
                hits[0].shopifyProductId,
                true,
            )
            usedTools.push("product_metafields")
            if (mf.metafieldsSummary) {
                productFacts += `\n\nMetafield details (category/catalog):\n${mf.metafieldsSummary}`
            }
        } else if (module === "CATEGORY_METADETAILS" && !input.categoryMetadetailsEnabled) {
            productFacts +=
                "\n\n(Store has category metadetails disabled — use KB only for category facts.)"
        }
    }

    const facts = [
        kbContext ? `Knowledge:\n${kbContext}` : "",
        orderFacts ? `Order data:\n${orderFacts}` : "",
        productFacts ? `Product search:\n${productFacts}` : "",
    ]
        .filter(Boolean)
        .join("\n\n")

    const text = await composeReply({
        storeName: input.storeName,
        facts: facts || "No knowledge base or order context was retrieved.",
        message: input.message,
        history: historyToGroq(input.history),
    })

    logger.info("[L1_ORCHESTRATOR]", {
        storeId: input.storeId,
        channel: input.channel,
        module,
        pillar,
        usedTools,
    })

    return {
        text,
        meta: {
            module,
            pillar,
            usedTools,
            kbHits: retrieval.kbCount,
            productHits: retrieval.productCount,
        },
    }
}
