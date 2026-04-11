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
import { searchProductsForStore } from "@/lib/ai/tools/productTools"
import {
    isAutomationEnabled,
    isModuleEnabled,
    needsIdentityGate,
    parseAiModulesJson,
} from "@/lib/ai/orchestrator/aiModules"
import { pillarForModule } from "@/lib/ai/orchestrator/manifests"
import { routeCustomerIntent } from "@/lib/ai/orchestrator/intentRouter"
import { formatSharedFieldsForModule } from "@/lib/ai/orchestrator/moduleThreeTypes"
import { parseSharedFieldAnswersJson } from "@/lib/kb/sharedFieldAnswers"
import type { L1Channel, L1Module, L1RunMeta } from "@/lib/ai/orchestrator/types"

const GENERIC_NO_ORDER_EMAIL =
    "We could not find a recent order associated with this email address. If you placed an order, please contact us from the same email you used at checkout, or reply with your order number from your confirmation email."

const WIDGET_VERIFY_PROMPT =
    "To look up order details or account-specific information, please enter the email you used when placing your order. We will send you a one-time code to verify."

const FAQ_DISABLED_FALLBACK =
    "I don't know about this—please contact our support team for help."

/** Transactional modules that load a single order row after verification + disambiguation. */
const ORDER_DETAIL_MODULES: L1Module[] = [
    "ORDER_STATUS",
    "ORDER_SUMMARY",
    "SHIPPING_TRACKING",
    "ORDER_CANCEL",
    "REFUND_STATUS",
]

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
    aiModulesJson: unknown
    /** Type-1 vendor answers keyed by sf_* (optional). */
    sharedFieldAnswersJson?: unknown
    /** DB flag; when set, overrides aiModules.CATEGORY_METADETAILS for metadetails tooling. */
    categoryMetadetailsEnabled?: boolean
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
    const sharedAnswers = parseSharedFieldAnswersJson(input.sharedFieldAnswersJson)
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
    let activeModule: L1Module = routed.module
    if (!isModuleEnabled(modules, activeModule)) {
        activeModule = "FAQ"
    }
    if (!isModuleEnabled(modules, activeModule)) {
        return {
            text: FAQ_DISABLED_FALLBACK,
            meta: {
                module: "UNKNOWN",
                pillar: "K",
                usedTools: [],
                kbHits: retrieval.kbCount,
                productHits: retrieval.productCount,
            },
        }
    }

    const pillar = pillarForModule(activeModule)
    const moduleFlags = modules[activeModule]
    const usedTools: string[] = []
    const type1Facts = formatSharedFieldsForModule(activeModule, sharedAnswers)
    const categoryMetadetailsOn =
        input.categoryMetadetailsEnabled !== undefined &&
        input.categoryMetadetailsEnabled !== null
            ? Boolean(input.categoryMetadetailsEnabled)
            : isModuleEnabled(modules, "CATEGORY_METADETAILS")

    let customerEmail: string | null = null
    if (input.channel === "email") {
        customerEmail = input.emailFrom?.trim().toLowerCase() || null
    } else {
        if (isWidgetSessionValid(input.widgetVerifiedEmail, input.widgetSessionExpiresAt)) {
            customerEmail = input.widgetVerifiedEmail!.trim().toLowerCase()
        }
    }

    const needsFiber = needsIdentityGate(pillar, moduleFlags)

    if (input.channel === "widget" && needsFiber && !customerEmail) {
        return {
            text: WIDGET_VERIFY_PROMPT,
            meta: {
                module: activeModule,
                pillar,
                usedTools: [],
                kbHits: retrieval.kbCount,
                productHits: retrieval.productCount,
            },
        }
    }

    if (needsFiber && input.channel === "email" && !customerEmail) {
        return {
            text: GENERIC_NO_ORDER_EMAIL,
            meta: {
                module: activeModule,
                pillar,
                usedTools,
                kbHits: retrieval.kbCount,
                productHits: retrieval.productCount,
            },
        }
    }

    const shouldListOrders =
        Boolean(customerEmail) &&
        (pillar === "X" ||
            (pillar === "T" && isAutomationEnabled(modules, activeModule, "verifiedLookup")))

    const ordersForEmail =
        customerEmail && shouldListOrders
            ? await listOrdersForCustomerEmail(input.storeId, customerEmail)
            : []

    if (
        (pillar === "T" || pillar === "X") &&
        ordersForEmail.length === 0 &&
        customerEmail
    ) {
        const facts = [
            type1Facts,
            kbContext ? `Knowledge:\n${kbContext}` : "",
            "No orders on file for this email in our cache.",
        ]
            .filter(Boolean)
            .join("\n\n")
        if (pillar === "X" && isAutomationEnabled(modules, activeModule, "ticket")) {
            return {
                text: ticketHandoffText(activeModule, input.storeName),
                meta: {
                    module: activeModule,
                    pillar,
                    usedTools: ["ticket_intake"],
                    kbHits: retrieval.kbCount,
                    productHits: retrieval.productCount,
                },
            }
        }
        if (
            pillar === "T" &&
            isAutomationEnabled(modules, activeModule, "ticket")
        ) {
            return {
                text: ticketHandoffText(activeModule, input.storeName),
                meta: {
                    module: activeModule,
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
                module: activeModule,
                pillar,
                usedTools,
                kbHits: retrieval.kbCount,
                productHits: retrieval.productCount,
            },
        }
    }

    if (
        pillar === "X" &&
        ordersForEmail.length > 0 &&
        isAutomationEnabled(modules, activeModule, "ticket")
    ) {
        return {
            text: ticketHandoffText(activeModule, input.storeName),
            meta: {
                module: activeModule,
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
        ORDER_DETAIL_MODULES.includes(activeModule) &&
        customerEmail &&
        disambiguate &&
        !input.boundShopifyOrderId &&
        isAutomationEnabled(modules, activeModule, "verifiedLookup")
    ) {
        const list = formatOrderCandidatesForPrompt(ordersForEmail)
        return {
            text: `We found more than one order for your email. Which order do you mean?\n${list}\n\nReply with the order number (e.g. #1002).`,
            meta: {
                module: activeModule,
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
        ORDER_DETAIL_MODULES.includes(activeModule) &&
        isAutomationEnabled(modules, activeModule, "verifiedLookup")
    ) {
        const detail = await getOrderDetailForVerifiedEmail(input.storeId, customerEmail, {
            shopifyOrderId: input.boundShopifyOrderId ?? undefined,
            orderNumberHint: hints[0],
        })
        usedTools.push("get_order_detail")
        if (detail) {
            const lines = [
                `Order ${detail.orderNumber} (${detail.shopifyOrderId})`,
                `Created: ${detail.shopifyCreatedAt ?? "unknown"}`,
                `Financial: ${detail.financialStatus ?? "unknown"}`,
                `Fulfillment: ${detail.fulfillmentStatus ?? "unknown"}`,
                `Total: ${detail.totalPrice} ${detail.currency ?? ""}`,
                detail.trackingNumber || detail.trackingUrl
                    ? `Tracking: ${detail.trackingCompany ?? ""} ${detail.trackingNumber ?? ""} ${detail.trackingUrl ?? ""}`.trim()
                    : "Tracking: not available in our cache yet.",
                `Line items (JSON): ${JSON.stringify(detail.lineItems).slice(0, 4000)}`,
            ]
            if (activeModule === "ORDER_CANCEL") {
                lines.push(
                    "Context: customer asked about cancellation — use only the statuses above; do not claim the order was cancelled unless Facts show it.",
                )
            }
            if (activeModule === "REFUND_STATUS") {
                lines.push(
                    "Context: customer asked about refund/payout status for this order — explain only what Financial/Fulfillment statuses imply; if unclear, say the team can confirm.",
                )
            }
            orderFacts = lines.join("\n")
        } else {
            orderFacts =
                "Order detail could not be loaded (missing order reference or no match for this email)."
        }
    }

    let productFacts = ""
    const runProductSearch =
        (activeModule === "PRODUCT_FIT" &&
            isAutomationEnabled(modules, activeModule, "knowledge")) ||
        (activeModule === "INVENTORY_STOCK" && isModuleEnabled(modules, activeModule))
    if (runProductSearch) {
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
        if (activeModule === "PRODUCT_FIT" && categoryMetadetailsOn) {
            usedTools.push("category_metadetails_enabled")
            productFacts = [
                productFacts,
                "Store setting: category metadetails from the database are enabled for this shop when tooling provides them (use only if present in Facts).",
            ]
                .filter(Boolean)
                .join("\n\n")
        }
    }

    const facts = [
        type1Facts,
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
        module: activeModule,
        pillar,
        usedTools,
    })

    return {
        text,
        meta: {
            module: activeModule,
            pillar,
            usedTools,
            kbHits: retrieval.kbCount,
            productHits: retrieval.productCount,
        },
    }
}
