/**
 * Vendor policy fields aligned with docs/req-AI.md §5–7 (shared_field_id concepts).
 * Keys are stable; labels are for dashboard UI.
 */

export type SharedFieldGroupId =
    | "ALL"
    | "FAQ"
    | "ORDER_STATUS"
    | "INVENTORY_STOCK"
    | "ORDER_CANCEL"
    | "HUMAN_ESCALATION"
    | "COMPLAINT"
    | "ORDER_SUMMARY"
    | "REFUND_STATUS"
    | "SHIPPING_TRACKING"
    | "WRONG_ITEM"
    | "RETURN_EXCHANGE"
    | "NOT_RECEIVED_MARKED_DELIVERED"
    | "SHIPMENT_STUCK_OR_DELAYED"
    | "PAYMENT_PROBLEM"
    | "ORDER_CHANGE"
    | "WARRANTY"
    | "PRODUCT_FIT"
    | "STORE_LOCAL"
    | "FEEDBACK"

export type SharedFieldDef = {
    id: string
    label: string
    description: string
    placeholder: string
    group: SharedFieldGroupId
}

/** Curated catalog (spec-mapped ids). */
export const SHARED_FIELD_CATALOG: SharedFieldDef[] = [
    // ALL — §6
    {
        id: "sf_brand_display_name",
        label: "Brand or store name (as customers see it)",
        description: "Consistent identity in automated replies.",
        placeholder: "e.g. Acme Outfitters",
        group: "ALL",
    },
    {
        id: "sf_store_one_liner",
        label: "What you sell and who it is for",
        description: "One or two sentences.",
        placeholder: "e.g. Sustainable outdoor apparel for weekend hikers…",
        group: "ALL",
    },
    {
        id: "sf_official_languages",
        label: "Languages you support in writing",
        description: "Sets expectations for email/chat.",
        placeholder: "e.g. English, Spanish",
        group: "ALL",
    },
    {
        id: "sf_support_channels",
        label: "Official support channels and hours",
        description: "Email, phone, chat, hours.",
        placeholder: "e.g. support@… ; Mon–Fri 9–5 ET",
        group: "ALL",
    },
    {
        id: "sf_support_first_response_sla",
        label: "Typical first response time",
        description: "Human or bot first reply expectation.",
        placeholder: "e.g. Within 24 business hours",
        group: "ALL",
    },
    {
        id: "sf_tone_and_words_to_avoid",
        label: "Tone and words or promises to avoid",
        description: "Brand-safe automation.",
        placeholder: "e.g. Friendly; avoid guaranteed delivery dates…",
        group: "ALL",
    },
    {
        id: "sf_order_id_help",
        label: "How customers find order number / confirmation",
        description: "Used across order-related flows.",
        placeholder: "e.g. In your confirmation email, subject line…",
        group: "ALL",
    },
    {
        id: "sf_first_message_checklist",
        label: "What to include when contacting support",
        description: "Faster resolution.",
        placeholder: "e.g. Order #, photos for damage…",
        group: "ALL",
    },
    {
        id: "sf_policy_link_terms",
        label: "Terms of sale URL",
        description: "Legal grounding.",
        placeholder: "https://…",
        group: "ALL",
    },
    {
        id: "sf_policy_link_privacy",
        label: "Privacy policy URL",
        description: "Trust.",
        placeholder: "https://…",
        group: "ALL",
    },
    {
        id: "sf_policy_link_returns",
        label: "Return / refund policy URL (if separate)",
        description: "Canonical policy link.",
        placeholder: "https://…",
        group: "ALL",
    },
    {
        id: "sf_privacy_support_paragraph",
        label: "Short paragraph: how data is used in support",
        description: "Privacy framing.",
        placeholder: "e.g. We use your email only to…",
        group: "ALL",
    },
    // Shipping / status (cross-cutting)
    {
        id: "sf_shipping_regions_served",
        label: "Regions you ship to",
        description: "",
        placeholder: "",
        group: "ORDER_STATUS",
    },
    {
        id: "sf_shipping_regions_excluded",
        label: "Regions you do not ship to",
        description: "",
        placeholder: "",
        group: "ORDER_STATUS",
    },
    {
        id: "sf_processing_time_before_ship",
        label: "Normal processing time before shipment",
        description: "",
        placeholder: "",
        group: "ORDER_STATUS",
    },
    {
        id: "sf_carriers_and_tracking_policy",
        label: "Carriers and when tracking is provided",
        description: "",
        placeholder: "",
        group: "SHIPPING_TRACKING",
    },
    {
        id: "sf_shipping_methods_and_transit",
        label: "Shipping methods and realistic transit ranges",
        description: "",
        placeholder: "",
        group: "SHIPPING_TRACKING",
    },
    {
        id: "sf_shipping_cost_model",
        label: "Shipping cost model (free / flat / dynamic)",
        description: "",
        placeholder: "",
        group: "FAQ",
    },
    {
        id: "sf_dispatch_cutoff",
        label: "Same-day dispatch cutoff (if any)",
        description: "",
        placeholder: "",
        group: "ORDER_STATUS",
    },
    {
        id: "sf_customs_duties_policy",
        label: "International duties disclaimer",
        description: "",
        placeholder: "",
        group: "FAQ",
    },
    {
        id: "sf_major_delay_communication",
        label: "When delayed before shipment or major delays",
        description: "",
        placeholder: "",
        group: "ORDER_STATUS",
    },
    {
        id: "sf_delivered_not_received_policy",
        label: "“Delivered” but not received — customer steps",
        description: "",
        placeholder: "",
        group: "NOT_RECEIVED_MARKED_DELIVERED",
    },
    {
        id: "sf_stuck_shipment_customer_steps",
        label: "When shipment seems stuck — what customer should do first",
        description: "",
        placeholder: "",
        group: "SHIPMENT_STUCK_OR_DELAYED",
    },
    // Cancellations / changes / returns
    {
        id: "sf_cancellation_window",
        label: "When cancellation is allowed",
        description: "",
        placeholder: "",
        group: "ORDER_CANCEL",
    },
    {
        id: "sf_cancellation_how_to_request",
        label: "How customers request cancellation",
        description: "",
        placeholder: "",
        group: "ORDER_CANCEL",
    },
    {
        id: "sf_order_change_allowed_until",
        label: "Until when order changes are sometimes possible",
        description: "",
        placeholder: "",
        group: "ORDER_CHANGE",
    },
    {
        id: "sf_order_change_how_to_request",
        label: "How to request an order change",
        description: "",
        placeholder: "",
        group: "ORDER_CHANGE",
    },
    {
        id: "sf_order_change_not_possible_next_step",
        label: "After cutoff / shipped — what to tell customers",
        description: "",
        placeholder: "",
        group: "ORDER_CHANGE",
    },
    {
        id: "sf_return_window",
        label: "Return window (days / trigger)",
        description: "",
        placeholder: "",
        group: "RETURN_EXCHANGE",
    },
    {
        id: "sf_return_condition_requirements",
        label: "Return condition requirements",
        description: "",
        placeholder: "",
        group: "RETURN_EXCHANGE",
    },
    {
        id: "sf_return_shipping_payer",
        label: "Who pays return shipping",
        description: "",
        placeholder: "",
        group: "RETURN_EXCHANGE",
    },
    {
        id: "sf_exchange_policy",
        label: "Exchange policy (swap vs credit vs refund)",
        description: "",
        placeholder: "",
        group: "RETURN_EXCHANGE",
    },
    {
        id: "sf_how_to_start_return",
        label: "How to start a return",
        description: "",
        placeholder: "",
        group: "RETURN_EXCHANGE",
    },
    {
        id: "sf_non_returnable_categories",
        label: "Non-returnable categories",
        description: "",
        placeholder: "",
        group: "RETURN_EXCHANGE",
    },
    {
        id: "sf_refund_methods",
        label: "Refund methods (original payment vs store credit)",
        description: "",
        placeholder: "",
        group: "REFUND_STATUS",
    },
    {
        id: "sf_refund_timeline_after_approval",
        label: "Timeline to money back after approval",
        description: "",
        placeholder: "",
        group: "REFUND_STATUS",
    },
    {
        id: "sf_partial_refund_rules",
        label: "Partial refund rules",
        description: "",
        placeholder: "",
        group: "REFUND_STATUS",
    },
    {
        id: "sf_store_credit_rules",
        label: "Store credit rules",
        description: "",
        placeholder: "",
        group: "REFUND_STATUS",
    },
    {
        id: "sf_failed_payment_guidance",
        label: "What customer should retry on failed payment",
        description: "",
        placeholder: "",
        group: "PAYMENT_PROBLEM",
    },
    {
        id: "sf_double_charge_intake",
        label: "What to send for duplicate charge claims",
        description: "",
        placeholder: "",
        group: "PAYMENT_PROBLEM",
    },
    {
        id: "sf_wrong_item_report_deadline",
        label: "Deadline to report wrong/damaged item",
        description: "",
        placeholder: "",
        group: "WRONG_ITEM",
    },
    {
        id: "sf_wrong_item_evidence",
        label: "Evidence required (photos, etc.)",
        description: "",
        placeholder: "",
        group: "WRONG_ITEM",
    },
    {
        id: "sf_wrong_item_remedies",
        label: "Remedies you offer (human executes)",
        description: "",
        placeholder: "",
        group: "WRONG_ITEM",
    },
    {
        id: "sf_warranty_duration_scope",
        label: "Warranty duration and scope",
        description: "",
        placeholder: "",
        group: "WARRANTY",
    },
    {
        id: "sf_warranty_voiders",
        label: "What voids warranty",
        description: "",
        placeholder: "",
        group: "WARRANTY",
    },
    {
        id: "sf_warranty_claim_process",
        label: "Warranty claim process",
        description: "",
        placeholder: "",
        group: "WARRANTY",
    },
    {
        id: "sf_sizing_fit_guidance",
        label: "Sizing and fit guidance",
        description: "",
        placeholder: "",
        group: "PRODUCT_FIT",
    },
    {
        id: "sf_compatibility_notes",
        label: "Compatibility notes (devices, voltage, region)",
        description: "",
        placeholder: "",
        group: "PRODUCT_FIT",
    },
    {
        id: "sf_materials_care_limitations",
        label: "Materials, care, limitations",
        description: "",
        placeholder: "",
        group: "PRODUCT_FIT",
    },
    {
        id: "sf_back_in_stock_policy",
        label: "Back-in-stock / notify policy",
        description: "",
        placeholder: "",
        group: "INVENTORY_STOCK",
    },
    {
        id: "sf_preorder_policy",
        label: "Preorder policy",
        description: "",
        placeholder: "",
        group: "INVENTORY_STOCK",
    },
    {
        id: "sf_physical_locations_hours",
        label: "Physical locations and hours",
        description: "",
        placeholder: "",
        group: "STORE_LOCAL",
    },
    {
        id: "sf_pickup_rules",
        label: "Pickup rules",
        description: "",
        placeholder: "",
        group: "STORE_LOCAL",
    },
    {
        id: "sf_instore_vs_online_inventory",
        label: "In-store vs online inventory",
        description: "",
        placeholder: "",
        group: "STORE_LOCAL",
    },
    {
        id: "sf_human_escalation_when",
        label: "When to ask a human",
        description: "",
        placeholder: "",
        group: "HUMAN_ESCALATION",
    },
    {
        id: "sf_complaint_acknowledgement_sla",
        label: "Complaint acknowledgement timing",
        description: "",
        placeholder: "",
        group: "COMPLAINT",
    },
    {
        id: "sf_complaint_supervisor_escalation",
        label: "When a lead reviews complaints",
        description: "",
        placeholder: "",
        group: "COMPLAINT",
    },
    {
        id: "sf_feedback_csat_process",
        label: "Feedback / CSAT process",
        description: "",
        placeholder: "",
        group: "FEEDBACK",
    },
    {
        id: "sf_order_summary_tax_invoice_note",
        label: "Tax / invoice limitations note",
        description: "",
        placeholder: "",
        group: "ORDER_SUMMARY",
    },
]

export const SHARED_FIELD_IDS = new Set(SHARED_FIELD_CATALOG.map((f) => f.id))

export function sharedFieldsByGroup(): Record<SharedFieldGroupId, SharedFieldDef[]> {
    const out = {} as Record<SharedFieldGroupId, SharedFieldDef[]>
    for (const g of [
        "ALL",
        "FAQ",
        "ORDER_STATUS",
        "INVENTORY_STOCK",
        "ORDER_CANCEL",
        "HUMAN_ESCALATION",
        "COMPLAINT",
        "ORDER_SUMMARY",
        "REFUND_STATUS",
        "SHIPPING_TRACKING",
        "WRONG_ITEM",
        "RETURN_EXCHANGE",
        "NOT_RECEIVED_MARKED_DELIVERED",
        "SHIPMENT_STUCK_OR_DELAYED",
        "PAYMENT_PROBLEM",
        "ORDER_CHANGE",
        "WARRANTY",
        "PRODUCT_FIT",
        "STORE_LOCAL",
        "FEEDBACK",
    ] as const) {
        out[g] = []
    }
    for (const f of SHARED_FIELD_CATALOG) {
        out[f.group].push(f)
    }
    return out
}
