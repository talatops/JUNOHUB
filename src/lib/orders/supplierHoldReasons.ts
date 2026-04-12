/** Stable codes stored in DB and Shopify metafield JSON. */
export const SUPPLIER_HOLD_REASON_CODES = [
    "inventory_out_of_stock",
    "address_incorrect",
    "high_risk_fraud",
    "awaiting_payment",
    "other",
] as const

export type SupplierHoldReasonCode = (typeof SUPPLIER_HOLD_REASON_CODES)[number]

export const SUPPLIER_HOLD_REASON_LABELS: Record<SupplierHoldReasonCode, string> = {
    inventory_out_of_stock: "Inventory out of stock",
    address_incorrect: "Address incorrect",
    high_risk_fraud: "High risk of fraud",
    awaiting_payment: "Awaiting payment",
    other: "Other",
}

export function isSupplierHoldReasonCode(v: string): v is SupplierHoldReasonCode {
    return (SUPPLIER_HOLD_REASON_CODES as readonly string[]).includes(v)
}

/** UI / API: fixed ordering for selects and modals. */
export const SUPPLIER_HOLD_REASON_OPTIONS: ReadonlyArray<{
    value: SupplierHoldReasonCode
    label: string
}> = SUPPLIER_HOLD_REASON_CODES.map((value) => ({
    value,
    label: SUPPLIER_HOLD_REASON_LABELS[value],
}))
