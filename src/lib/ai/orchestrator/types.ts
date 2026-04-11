export type L1Channel = "widget" | "email"

export type L1Pillar = "K" | "T" | "X" | "CAT"

export type L1Module =
    | "FAQ"
    | "ORDER_STATUS"
    | "ORDER_SUMMARY"
    | "SHIPPING_TRACKING"
    | "INVENTORY_STOCK"
    | "CATEGORY_METADETAILS"
    | "PRODUCT_FIT"
    | "RETURN_EXCHANGE"
    | "ORDER_CHANGE"
    | "COMPLAINT"
    | "NOT_RECEIVED_MARKED_DELIVERED"
    | "SHIPMENT_STUCK_OR_DELAYED"
    | "PAYMENT_PROBLEM"
    | "UNKNOWN"

export type L1RunMeta = {
    module: L1Module
    pillar: L1Pillar
    usedTools: string[]
    kbHits?: number
    productHits?: number
}
