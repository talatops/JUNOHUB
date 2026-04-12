export type CanonicalFulfillmentStatus =
    | "UNFULFILLED"
    | "IN_PROGRESS"
    | "ON_HOLD"
    | "SHIPPED"
    | "FULFILLED"
    | "CANCELLED"

const SHOPIFY_FULFILLMENT_MAP: Record<CanonicalFulfillmentStatus, string> = {
    UNFULFILLED: "unfulfilled",
    IN_PROGRESS: "in_progress",
    ON_HOLD: "on_hold",
    SHIPPED: "shipped",
    FULFILLED: "fulfilled",
    CANCELLED: "cancelled",
}

export function normalizeFulfillmentStatus(input: string | null | undefined): CanonicalFulfillmentStatus {
    const raw = String(input ?? "")
        .trim()
        .replace(/[\s-]+/g, "_")
        .toUpperCase()

    if (raw === "FULFILLED") return "FULFILLED"
    if (raw === "SHIPPED") return "SHIPPED"
    if (raw === "IN_PROGRESS" || raw === "INPROGRESS" || raw === "PARTIAL" || raw === "PARTIALLY_FULFILLED") {
        return "IN_PROGRESS"
    }
    if (raw === "CANCELLED" || raw === "CANCELED") return "CANCELLED"
    if (raw === "ON_HOLD" || raw === "ONHOLD" || raw === "HOLD" || raw === "PENDING_HOLD") {
        return "ON_HOLD"
    }
    return "UNFULFILLED"
}

export function toVendorDisplayStatus(input: string | null | undefined): string {
    return SHOPIFY_FULFILLMENT_MAP[normalizeFulfillmentStatus(input)]
}

export function isFulfilledLike(input: string | null | undefined): boolean {
    return normalizeFulfillmentStatus(input) === "FULFILLED"
}

