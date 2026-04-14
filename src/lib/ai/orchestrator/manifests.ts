import type { L1Module, L1Pillar } from "@/lib/ai/orchestrator/types"

export type ModuleManifest = {
    pillar: L1Pillar
    /** Slots still needed beyond verification email. */
    typicalSlots: string[]
}

export const MODULE_MANIFESTS: Record<L1Module, ModuleManifest> = {
    FAQ: { pillar: "K", typicalSlots: [] },
    CATEGORY_METADETAILS: { pillar: "K", typicalSlots: [] },
    STORE_LOCAL: { pillar: "K", typicalSlots: [] },
    FEEDBACK: { pillar: "K", typicalSlots: [] },
    HUMAN_ESCALATION: { pillar: "K", typicalSlots: [] },
    PRODUCT_FIT: { pillar: "K", typicalSlots: ["product_query"] },
    ORDER_STATUS: { pillar: "T", typicalSlots: ["order_ref"] },
    ORDER_SUMMARY: { pillar: "T", typicalSlots: ["order_ref"] },
    SHIPPING_TRACKING: { pillar: "T", typicalSlots: ["order_ref"] },
    ORDER_CANCEL: { pillar: "T", typicalSlots: ["order_ref"] },
    REFUND_STATUS: { pillar: "T", typicalSlots: ["order_ref"] },
    INVENTORY_STOCK: { pillar: "K", typicalSlots: ["product_query"] },
    RETURN_EXCHANGE: { pillar: "X", typicalSlots: ["order_ref", "reason"] },
    ORDER_CHANGE: { pillar: "X", typicalSlots: ["order_ref", "change_request"] },
    COMPLAINT: { pillar: "X", typicalSlots: ["issue"] },
    NOT_RECEIVED_MARKED_DELIVERED: { pillar: "X", typicalSlots: ["order_ref"] },
    SHIPMENT_STUCK_OR_DELAYED: { pillar: "X", typicalSlots: ["order_ref"] },
    PAYMENT_PROBLEM: { pillar: "X", typicalSlots: ["order_ref", "issue"] },
    WARRANTY: { pillar: "X", typicalSlots: ["order_ref", "issue"] },
    WRONG_ITEM: { pillar: "X", typicalSlots: ["order_ref", "issue"] },
    UNKNOWN: { pillar: "K", typicalSlots: [] },
}

export function pillarForModule(module: L1Module): L1Pillar {
    return MODULE_MANIFESTS[module]?.pillar ?? "K"
}
