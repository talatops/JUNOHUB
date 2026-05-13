export type L1Channel = "widget" | "email"

export type L1Pillar = "K" | "T" | "X"

export type L1Module =
    | "FAQ"
    | "CATEGORY_METADETAILS"
    | "STORE_LOCAL"
    | "FEEDBACK"
    | "HUMAN_ESCALATION"
    | "PRODUCT_FIT"
    | "ORDER_STATUS"
    | "ORDER_SUMMARY"
    | "SHIPPING_TRACKING"
    | "ORDER_CANCEL"
    | "REFUND_STATUS"
    | "INVENTORY_STOCK"
    | "RETURN_EXCHANGE"
    | "ORDER_CHANGE"
    | "COMPLAINT"
    | "NOT_RECEIVED_MARKED_DELIVERED"
    | "SHIPMENT_STUCK_OR_DELAYED"
    | "PAYMENT_PROBLEM"
    | "WARRANTY"
    | "WRONG_ITEM"
    | "UNKNOWN"

export const L1_MODULE_IDS: L1Module[] = [
    "FAQ",
    "CATEGORY_METADETAILS",
    "STORE_LOCAL",
    "FEEDBACK",
    "HUMAN_ESCALATION",
    "PRODUCT_FIT",
    "ORDER_STATUS",
    "ORDER_SUMMARY",
    "SHIPPING_TRACKING",
    "ORDER_CANCEL",
    "REFUND_STATUS",
    "INVENTORY_STOCK",
    "RETURN_EXCHANGE",
    "ORDER_CHANGE",
    "COMPLAINT",
    "NOT_RECEIVED_MARKED_DELIVERED",
    "SHIPMENT_STUCK_OR_DELAYED",
    "PAYMENT_PROBLEM",
    "WARRANTY",
    "WRONG_ITEM",
    "UNKNOWN",
]

export type L1RunMeta = {
    module: L1Module
    pillar: L1Pillar
    usedTools: string[]
    kbHits?: number
    productHits?: number
    allowedUpsellCount?: number
}
