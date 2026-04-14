import type { L1Module } from "@/lib/ai/orchestrator/types"
import { MODULE_MANIFESTS } from "@/lib/ai/orchestrator/manifests"
import type { L1Pillar } from "@/lib/ai/orchestrator/types"

/** Short customer-intent labels aligned with intentRouter modules. */
export const L1_MODULE_CUSTOMER_LABEL: Record<L1Module, string> = {
    FAQ: "General policies, shipping basics, refund policy (not live order/refund status)",
    CATEGORY_METADETAILS:
        "Store-wide: allow DB-backed category metadetails in answers (when synced). Sizing/fit flows use this with Product fit.",
    STORE_LOCAL: "Store hours, pickup, local / in-person info",
    FEEDBACK: "After-resolution feedback, surveys, thank-yous",
    HUMAN_ESCALATION: "Customer wants a real person; routing and handoff copy",
    PRODUCT_FIT:
        "Sizing, fit, compatibility — knowledge search; category metadetails when that toggle is on",
    ORDER_STATUS: "Where is my order, processing time, not shipped yet",
    ORDER_SUMMARY: "Receipt recap, what did I order, line items",
    SHIPPING_TRACKING: "Tracking number, carrier, delivery / ETA",
    ORDER_CANCEL: "Cancel order eligibility and requests (DB-backed when available)",
    REFUND_STATUS: "Status of my refund or return payout (not refund policy text)",
    INVENTORY_STOCK: "Is this item in stock, availability",
    RETURN_EXCHANGE: "Start a return or exchange (ticket)",
    ORDER_CHANGE: "Change address, items, or quantity (ticket)",
    COMPLAINT: "Strong dissatisfaction (ticket)",
    NOT_RECEIVED_MARKED_DELIVERED: "Tracking shows delivered but parcel not received (ticket)",
    SHIPMENT_STUCK_OR_DELAYED: "Shipment not moving or very late (ticket)",
    PAYMENT_PROBLEM: "Double charge, wrong amount, promo failed (ticket)",
    WARRANTY: "Warranty claim after return window (ticket)",
    WRONG_ITEM: "Wrong, damaged, or missing item (ticket)",
    UNKNOWN: "Other / uncategorized",
}

type VendorUiModule = Exclude<L1Module, "UNKNOWN">

/**
 * Canonical module order for dashboard settings.
 * Groups below are derived from `MODULE_MANIFESTS` (single source of truth for pillar).
 */
const MODULE_UI_ORDER: VendorUiModule[] = [
    "FAQ",
    "CATEGORY_METADETAILS",
    "STORE_LOCAL",
    "FEEDBACK",
    "HUMAN_ESCALATION",
    "PRODUCT_FIT",
    "INVENTORY_STOCK",
    "ORDER_STATUS",
    "ORDER_SUMMARY",
    "SHIPPING_TRACKING",
    "ORDER_CANCEL",
    "REFUND_STATUS",
    "RETURN_EXCHANGE",
    "ORDER_CHANGE",
    "COMPLAINT",
    "NOT_RECEIVED_MARKED_DELIVERED",
    "SHIPMENT_STUCK_OR_DELAYED",
    "PAYMENT_PROBLEM",
    "WARRANTY",
    "WRONG_ITEM",
]

/** Knowledge modules shown under “Knowledge” (FAQ + metadetails are separate cards). */
export const L1_KNOWLEDGE_MODULES_UI = MODULE_UI_ORDER.filter(
    (m) => m !== "FAQ" && m !== "CATEGORY_METADETAILS" && MODULE_MANIFESTS[m].pillar === "K",
)

export const L1_TRANSACTIONAL_MODULES_UI = MODULE_UI_ORDER.filter(
    (m) => MODULE_MANIFESTS[m].pillar === "T",
)

export const L1_TICKET_MODULES_UI = MODULE_UI_ORDER.filter(
    (m) => MODULE_MANIFESTS[m].pillar === "X",
)

/** Short dashboard card titles (grid + modal heading). */
export const L1_MODULE_CARD_TITLE: Record<Exclude<L1Module, "UNKNOWN">, string> = {
    FAQ: "General knowledge (FAQ)",
    CATEGORY_METADETAILS: "Category metadetails",
    STORE_LOCAL: "Store hours & local",
    FEEDBACK: "Feedback & thanks",
    HUMAN_ESCALATION: "Talk to a human",
    PRODUCT_FIT: "Product fit & sizing",
    ORDER_STATUS: "Order status",
    ORDER_SUMMARY: "Order summary",
    SHIPPING_TRACKING: "Shipping & tracking",
    ORDER_CANCEL: "Order cancellation",
    REFUND_STATUS: "Refund / payout status",
    INVENTORY_STOCK: "Stock & availability",
    RETURN_EXCHANGE: "Returns & exchanges",
    ORDER_CHANGE: "Order changes",
    COMPLAINT: "Complaints",
    NOT_RECEIVED_MARKED_DELIVERED: "Delivered, not received",
    SHIPMENT_STUCK_OR_DELAYED: "Stuck or delayed shipment",
    PAYMENT_PROBLEM: "Payment problems",
    WARRANTY: "Warranty",
    WRONG_ITEM: "Wrong / damaged / missing item",
}

/** Pillars where the vendor may toggle automation per intent (not FAQ-style knowledge routing). */
export function pillarHasAutomationToggle(pillar: L1Pillar): boolean {
    return pillar === "T" || pillar === "X"
}

export function modulePillar(module: L1Module): L1Pillar {
    return MODULE_MANIFESTS[module]?.pillar ?? "K"
}

export function moduleShowsPerIntentToggle(module: L1Module): boolean {
    if (module === "UNKNOWN") return false
    return pillarHasAutomationToggle(modulePillar(module))
}
