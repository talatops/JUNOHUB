import type { L1Module } from "@/lib/ai/orchestrator/types"

const DEFAULT_ENABLED: Record<L1Module, boolean> = {
    FAQ: true,
    ORDER_STATUS: true,
    ORDER_SUMMARY: true,
    SHIPPING_TRACKING: true,
    INVENTORY_STOCK: true,
    CATEGORY_METADETAILS: true,
    PRODUCT_FIT: true,
    RETURN_EXCHANGE: true,
    ORDER_CHANGE: true,
    COMPLAINT: true,
    NOT_RECEIVED_MARKED_DELIVERED: true,
    SHIPMENT_STUCK_OR_DELAYED: true,
    PAYMENT_PROBLEM: true,
    UNKNOWN: true,
}

export function parseAiModulesJson(raw: unknown): Record<string, boolean> {
    if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
        return { ...DEFAULT_ENABLED }
    }
    const o = raw as Record<string, unknown>
    const out: Record<string, boolean> = { ...DEFAULT_ENABLED }
    for (const k of Object.keys(DEFAULT_ENABLED) as L1Module[]) {
        if (k in o && typeof o[k] === "boolean") {
            out[k] = o[k] as boolean
        }
    }
    return out
}

export function isModuleEnabled(
    modules: Record<string, boolean>,
    module: L1Module,
): boolean {
    if (module === "UNKNOWN") return true
    return modules[module] !== false
}
