import { groqChatCompletion } from "@/lib/ai/groqClient"
import { logger } from "@/lib/logger"
import type { L1Module } from "@/lib/ai/orchestrator/types"

const MODULES: L1Module[] = [
    "FAQ",
    "ORDER_STATUS",
    "ORDER_SUMMARY",
    "SHIPPING_TRACKING",
    "INVENTORY_STOCK",
    "CATEGORY_METADETAILS",
    "PRODUCT_FIT",
    "RETURN_EXCHANGE",
    "ORDER_CHANGE",
    "COMPLAINT",
    "NOT_RECEIVED_MARKED_DELIVERED",
    "SHIPMENT_STUCK_OR_DELAYED",
    "PAYMENT_PROBLEM",
    "UNKNOWN",
]

const ROUTER_PROMPT = `You route ecommerce customer messages to exactly one module.

Modules:
- FAQ: general policies, how shipping works, refund policy (not status), hours, contact.
- ORDER_STATUS: where is my order, processing time, not shipped yet.
- ORDER_SUMMARY: receipt, what did I order, line items recap.
- SHIPPING_TRACKING: tracking number, carrier, delivered, ETA.
- INVENTORY_STOCK: is item in stock, availability.
- CATEGORY_METADETAILS: materials, voltage, category-level specs from catalog.
- PRODUCT_FIT: sizing, fit, compatibility (may overlap FAQ).
- RETURN_EXCHANGE: start a return or exchange.
- ORDER_CHANGE: change address/items/qty.
- COMPLAINT: strong dissatisfaction.
- NOT_RECEIVED_MARKED_DELIVERED: tracking says delivered but customer did not receive.
- SHIPMENT_STUCK_OR_DELAYED: package not moving / very late.
- PAYMENT_PROBLEM: double charge, wrong amount, promo failed.
- UNKNOWN: does not fit above.

Return JSON only: {"module":"<ONE_FROM_LIST>","missing_slots":["order_ref"|"product_query"|"reason"|"issue"]}

Use missing_slots: order_ref if order # would help; product_query if product name/SKU needed.`

export type RoutedIntent = {
    module: L1Module
    missing_slots: string[]
}

function parseModule(s: string | undefined): L1Module {
    const t = (s || "").trim().toUpperCase()
    const found = MODULES.find((m) => m === t)
    return found ?? "UNKNOWN"
}

export async function routeCustomerIntent(userMessage: string): Promise<RoutedIntent> {
    const { content, error } = await groqChatCompletion(
        [
            { role: "system", content: ROUTER_PROMPT },
            { role: "user", content: userMessage.slice(0, 4000) },
        ],
        { jsonObject: true, temperature: 0.1, maxTokens: 256 },
    )

    if (!content) {
        logger.warn("intentRouter: groq failed", { error })
        return { module: "FAQ", missing_slots: [] }
    }

    try {
        const j = JSON.parse(content) as { module?: string; missing_slots?: string[] }
        const module = parseModule(j.module)
        const slots = Array.isArray(j.missing_slots)
            ? j.missing_slots.filter((x) => typeof x === "string")
            : []
        return { module, missing_slots: slots }
    } catch {
        logger.warn("intentRouter: invalid JSON", { preview: content.slice(0, 120) })
        return { module: "FAQ", missing_slots: [] }
    }
}
