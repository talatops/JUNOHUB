import type { L1Module } from "@/lib/ai/orchestrator/types"

/** One Type-1 questionnaire row inside a module (several rows per broad module). */
export type ModuleType1Row = {
    /** Doc label e.g. OS1, FQ3 */
    code: string
    /** Vendor-facing prompt */
    label: string
    /** shared_field_id keys; one textarea each (SSoT across modules). */
    fieldKeys: string[]
}

export type ModuleThreeTypeSpec = {
    /** Show link to Knowledge base for G1–G12 (ALL). */
    referencesGlobalAll: boolean
    type1Rows: ModuleType1Row[]
    /** Read-only: verification & prerequisites (platform). No vendor text here. */
    type2Bullets: string[]
    /** Read-only: what L1/tickets do. No vendor script — tone from Type 1 + store voice. */
    type3Bullets: string[]
}

const T2_NONE_ANONYMOUS_KB = [
    "None for anonymous FAQ on the widget — answers use knowledge only (§1.2).",
]

const T2_ORDER_SCOPED = [
    "Email: From must match the email on the order in our database; multi-order disambiguation when needed (§1.1).",
    "Widget: email + OTP + session TTL before any order-specific data (§1.2).",
    "Slots: order reference or pick from a short candidate list.",
]

const T2_ORDER_SCOPED_STRICT = [
    ...T2_ORDER_SCOPED,
    "Same strict verification as other sensitive (fiber) flows.",
]

const T2_PRODUCT_SKU = [
    "Slots: product name and/or SKU; disambiguate when many products match.",
    "Widget: may allow anonymous stock checks, or require OTP if tied to “my order” (product policy).",
]

const T2_OPTIONAL_PRODUCT = [
    "Optional product name/SKU for specificity; no order required for general fit questions.",
]

const T2_CATEGORY_ENABLED = [
    "You enable this store-wide feature; sync must persist category metadetails in the database.",
    "Slots: resolve product → category (e.g. name/SKU → category) before tool calls.",
]

const T2_MINIMAL = [
    "Minimal prerequisites — optional context only; no order read unless combined with another intent.",
]

const T2_FEEDBACK = [
    "Optional link to prior ticket or context if your product supports it.",
]

const T2_REFUND_STATUS = [
    "Verified identity plus order or return reference (per your schema).",
]

const T2_PAYMENT = [
    "Order-scoped payment issues: verified identity + order id.",
    "Pre-purchase / checkout failures: may only have email + narrative → ticket with available context.",
]

const T2_ORDER_CHANGE = [
    ...T2_ORDER_SCOPED,
    "Capture requested change (address / items / qty) as slots for the ticket.",
]

const T2_RETURN = [
    ...T2_ORDER_SCOPED,
    "Optional reason / return intent slot.",
]

const T2_WRONG_ITEM = [
    ...T2_ORDER_SCOPED,
    "Issue type slot; email may include photo attachments.",
]

const T2_WARRANTY = [
    "Verified identity plus proof-of-purchase / order reference.",
]

export const MODULE_THREE_TYPES: Record<Exclude<L1Module, "UNKNOWN">, ModuleThreeTypeSpec> = {
    FAQ: {
        referencesGlobalAll: true,
        type1Rows: [
            {
                code: "FQ1",
                label: "Shipping — regions, methods, costs, timelines",
                fieldKeys: [
                    "sf_shipping_regions_served",
                    "sf_shipping_regions_excluded",
                    "sf_shipping_methods_and_transit",
                    "sf_shipping_cost_model",
                    "sf_processing_time_before_ship",
                ],
            },
            {
                code: "FQ2",
                label: "Returns — window, condition, non-returnables, who pays shipping",
                fieldKeys: [
                    "sf_return_window",
                    "sf_return_condition_requirements",
                    "sf_non_returnable_categories",
                    "sf_return_shipping_payer",
                    "sf_how_to_start_return",
                ],
            },
            {
                code: "FQ3",
                label: "Refund policy (wording only — not live refund status)",
                fieldKeys: [
                    "sf_refund_methods",
                    "sf_refund_timeline_after_approval",
                    "sf_partial_refund_rules",
                    "sf_store_credit_rules",
                ],
            },
            {
                code: "FQ4",
                label: "Payment methods & failed payment guidance",
                fieldKeys: ["sf_payment_methods_accepted", "sf_failed_payment_guidance"],
            },
            {
                code: "FQ5",
                label: "Promo / discount rules",
                fieldKeys: ["sf_promo_discount_rules"],
            },
            {
                code: "FQ6",
                label: "Tax display at checkout",
                fieldKeys: ["sf_tax_display_policy"],
            },
            {
                code: "FQ7",
                label: "How customers reach you",
                fieldKeys: ["sf_support_channels", "sf_support_first_response_sla"],
            },
            {
                code: "FQ8",
                label: "Policy links (terms, privacy, returns)",
                fieldKeys: [
                    "sf_policy_link_terms",
                    "sf_policy_link_privacy",
                    "sf_policy_link_returns",
                ],
            },
        ],
        type2Bullets: T2_NONE_ANONYMOUS_KB,
        type3Bullets: [
            "L1: retrieve answers from your Type-1 text and the knowledge base (+ global store voice).",
            "Out-of-scope questions: suggest email or ticket using your support channels — no fixed script from you here.",
        ],
    },
    CATEGORY_METADETAILS: {
        referencesGlobalAll: false,
        type1Rows: [],
        type2Bullets: T2_CATEGORY_ENABLED,
        type3Bullets: [
            "When enabled: tool calls may read category metadetails from the database for all synced categories.",
            "When disabled or empty: fall back to Product fit / FAQ, PDP links, or escalation — no metadetails tools.",
            "If data is missing or unclear: clarify or ticket per global / product-fit policy.",
        ],
    },
    STORE_LOCAL: {
        referencesGlobalAll: true,
        type1Rows: [
            {
                code: "SL1",
                label: "Physical locations, hours, holidays",
                fieldKeys: ["sf_physical_locations_hours"],
            },
            {
                code: "SL2",
                label: "Pickup rules",
                fieldKeys: ["sf_pickup_rules"],
            },
            {
                code: "SL3",
                label: "In-store vs online inventory",
                fieldKeys: ["sf_instore_vs_online_inventory"],
            },
            {
                code: "SL4",
                label: "Local returns (how to start)",
                fieldKeys: ["sf_how_to_start_return"],
            },
        ],
        type2Bullets: ["None — typical knowledge replies need no identity verification."],
        type3Bullets: [
            "L1: KB-only from Type-1 and store voice; no order tools.",
        ],
    },
    FEEDBACK: {
        referencesGlobalAll: true,
        type1Rows: [
            {
                code: "FB1",
                label: "CSAT / survey process",
                fieldKeys: ["sf_feedback_csat_process"],
            },
            {
                code: "FB2",
                label: "Tone & words to avoid (also in global voice)",
                fieldKeys: ["sf_tone_and_words_to_avoid"],
            },
        ],
        type2Bullets: T2_FEEDBACK,
        type3Bullets: [
            "L1: share CSAT / survey link or one-shot ask from Type-1.",
            "Negative follow-up: route to human when your process requires it.",
        ],
    },
    HUMAN_ESCALATION: {
        referencesGlobalAll: true,
        type1Rows: [
            {
                code: "HE1",
                label: "When to offer a human",
                fieldKeys: ["sf_human_escalation_when"],
            },
            {
                code: "HE2",
                label: "Support channels & SLA",
                fieldKeys: ["sf_support_channels", "sf_support_first_response_sla"],
            },
            {
                code: "HE3",
                label: "First message checklist",
                fieldKeys: ["sf_first_message_checklist"],
            },
        ],
        type2Bullets: T2_MINIMAL,
        type3Bullets: [
            "L1: acknowledgement + routing copy grounded in Type-1 and store voice.",
            "Ticket: created when your rules require — message wording is model-chosen, not vendor-scripted.",
        ],
    },
    PRODUCT_FIT: {
        referencesGlobalAll: true,
        type1Rows: [
            {
                code: "PF1",
                label: "Sizing & fit guidance",
                fieldKeys: ["sf_sizing_fit_guidance"],
            },
            {
                code: "PF2",
                label: "Compatibility (devices, voltage, region)",
                fieldKeys: ["sf_compatibility_notes"],
            },
            {
                code: "PF3",
                label: "Materials, care, limitations",
                fieldKeys: ["sf_materials_care_limitations"],
            },
            {
                code: "PF4",
                label: "When to escalate to a human",
                fieldKeys: ["sf_human_escalation_when"],
            },
        ],
        type2Bullets: T2_OPTIONAL_PRODUCT,
        type3Bullets: [
            "L1: KB + product search; category metadetails tools only when Category metadetails is enabled.",
            "Edge cases: escalate per Type-1 — phrasing follows your store voice.",
        ],
    },
    ORDER_STATUS: {
        referencesGlobalAll: true,
        type1Rows: [
            {
                code: "OS1",
                label: "Normal processing time before shipment",
                fieldKeys: ["sf_processing_time_before_ship"],
            },
            {
                code: "OS3",
                label: "If delayed before shipment, what we tell customers",
                fieldKeys: ["sf_major_delay_communication"],
            },
            {
                code: "OS4",
                label: "Ship to / do not ship to",
                fieldKeys: ["sf_shipping_regions_served", "sf_shipping_regions_excluded"],
            },
            {
                code: "OS5",
                label: "Order # help & first-message checklist",
                fieldKeys: ["sf_order_id_help", "sf_first_message_checklist"],
            },
        ],
        type2Bullets: T2_ORDER_SCOPED,
        type3Bullets: [
            "L1: read order/fulfillment from DB after verification; blend Type-1 messaging.",
            "Ticket: data missing, anomaly, or outside playbook — no vendor-authored ticket script.",
        ],
    },
    ORDER_SUMMARY: {
        referencesGlobalAll: true,
        type1Rows: [
            {
                code: "SM1",
                label: "Tax / invoice disclaimer",
                fieldKeys: ["sf_order_summary_tax_invoice_note"],
            },
            {
                code: "SM2",
                label: "Order # help & checklist",
                fieldKeys: ["sf_order_id_help", "sf_first_message_checklist"],
            },
        ],
        type2Bullets: T2_ORDER_SCOPED,
        type3Bullets: [
            "L1: read line items/totals; wrap with Type-1 disclaimers.",
            "Ticket: tax/invoice edge cases per your policy — human decides.",
        ],
    },
    SHIPPING_TRACKING: {
        referencesGlobalAll: true,
        type1Rows: [
            {
                code: "ST1",
                label: "Carriers & tracking policy",
                fieldKeys: ["sf_carriers_and_tracking_policy"],
            },
            {
                code: "ST2",
                label: "Shipping methods & transit expectations",
                fieldKeys: ["sf_shipping_methods_and_transit"],
            },
            {
                code: "ST3",
                label: "Shipping cost model & dispatch cutoff",
                fieldKeys: ["sf_shipping_cost_model", "sf_dispatch_cutoff"],
            },
            {
                code: "ST4",
                label: "Regions & customs",
                fieldKeys: ["sf_shipping_regions_served", "sf_customs_duties_policy"],
            },
        ],
        type2Bullets: T2_ORDER_SCOPED,
        type3Bullets: [
            "L1: read tracking fields for the verified order + Type-1 carrier copy.",
            "Ticket: carrier claim/dispute handoff — wording is adaptive.",
        ],
    },
    ORDER_CANCEL: {
        referencesGlobalAll: true,
        type1Rows: [
            {
                code: "CX1",
                label: "Cancellation window & how to request",
                fieldKeys: ["sf_cancellation_window", "sf_cancellation_how_to_request"],
            },
            {
                code: "CX2",
                label: "Pre-order / digital exceptions",
                fieldKeys: ["sf_cancellation_preorder_digital"],
            },
            {
                code: "CX3",
                label: "If change/cancel no longer possible — next step",
                fieldKeys: ["sf_order_change_not_possible_next_step"],
            },
            {
                code: "CX4",
                label: "Refund timing (policy wording)",
                fieldKeys: ["sf_refund_timeline_after_approval", "sf_refund_methods"],
            },
        ],
        type2Bullets: T2_ORDER_SCOPED,
        type3Bullets: [
            "L1: eligibility + cancel when DB/rules allow; else explain from Type-1.",
            "Ticket: ambiguous or disallowed cases — human judgment.",
        ],
    },
    REFUND_STATUS: {
        referencesGlobalAll: true,
        type1Rows: [
            {
                code: "RF1",
                label: "Refund methods & timeline (policy)",
                fieldKeys: ["sf_refund_methods", "sf_refund_timeline_after_approval"],
            },
            {
                code: "RF2",
                label: "Partial refunds & store credit",
                fieldKeys: ["sf_partial_refund_rules", "sf_store_credit_rules"],
            },
        ],
        type2Bullets: T2_REFUND_STATUS,
        type3Bullets: [
            "L1: read refund/return state from DB when modeled; align with Type-1 timelines.",
            "Ticket: state missing or ambiguous after verification.",
        ],
    },
    INVENTORY_STOCK: {
        referencesGlobalAll: true,
        type1Rows: [
            {
                code: "IV1",
                label: "Back in stock",
                fieldKeys: ["sf_back_in_stock_policy"],
            },
            {
                code: "IV2",
                label: "Pre-orders",
                fieldKeys: ["sf_preorder_policy"],
            },
            {
                code: "IV3",
                label: "Discontinued products",
                fieldKeys: ["sf_discontinued_product_policy"],
            },
            {
                code: "IV4",
                label: "In-store vs online inventory",
                fieldKeys: ["sf_instore_vs_online_inventory"],
            },
        ],
        type2Bullets: T2_PRODUCT_SKU,
        type3Bullets: [
            "L1: inventory read from DB + Type-1 snippets.",
            "Heavy disambiguation: clarify or ticket — replies use your tone from global + Type-1.",
        ],
    },
    RETURN_EXCHANGE: {
        referencesGlobalAll: true,
        type1Rows: [
            {
                code: "RE1",
                label: "Return window & condition",
                fieldKeys: ["sf_return_window", "sf_return_condition_requirements"],
            },
            {
                code: "RE2",
                label: "Non-returnables & return shipping payer",
                fieldKeys: ["sf_non_returnable_categories", "sf_return_shipping_payer"],
            },
            {
                code: "RE3",
                label: "Exchange policy & how to start",
                fieldKeys: ["sf_exchange_policy", "sf_how_to_start_return"],
            },
            {
                code: "RE4",
                label: "Refund policy (wording)",
                fieldKeys: ["sf_refund_methods", "sf_refund_timeline_after_approval"],
            },
        ],
        type2Bullets: T2_RETURN,
        type3Bullets: [
            "L1: policy in reply from Type-1 + open ticket (or portal later).",
            "Human/ops fulfills RMA — no fixed customer script from you.",
        ],
    },
    ORDER_CHANGE: {
        referencesGlobalAll: true,
        type1Rows: [
            {
                code: "OC1",
                label: "Until when changes are sometimes possible",
                fieldKeys: ["sf_order_change_allowed_until"],
            },
            {
                code: "OC2",
                label: "How to request a change",
                fieldKeys: ["sf_order_change_how_to_request"],
            },
            {
                code: "OC3",
                label: "When change is not possible — next step",
                fieldKeys: ["sf_order_change_not_possible_next_step"],
            },
            {
                code: "OC4",
                label: "Cancel alternative",
                fieldKeys: ["sf_cancellation_window", "sf_cancellation_how_to_request"],
            },
        ],
        type2Bullets: T2_ORDER_CHANGE,
        type3Bullets: [
            "L1 v1: no auto-mutate order — acknowledgement + ticket only.",
            "Human decides feasibility; tone from Type-1 + store voice.",
        ],
    },
    COMPLAINT: {
        referencesGlobalAll: true,
        type1Rows: [
            {
                code: "CP1",
                label: "Complaint acknowledgement SLA & escalation",
                fieldKeys: [
                    "sf_complaint_acknowledgement_sla",
                    "sf_complaint_supervisor_escalation",
                ],
            },
            {
                code: "CP2",
                label: "Abusive contact policy",
                fieldKeys: ["sf_abusive_contact_policy"],
            },
            {
                code: "CP3",
                label: "Remedies summary & support channels",
                fieldKeys: ["sf_wrong_item_remedies", "sf_refund_methods", "sf_support_channels"],
            },
        ],
        type2Bullets: T2_ORDER_SCOPED_STRICT,
        type3Bullets: [
            "L1: empathetic acknowledgement + severity intake; Type-1 informs boundaries.",
            "Ticket: always created; human owns resolution — model chooses wording within your tone.",
        ],
    },
    NOT_RECEIVED_MARKED_DELIVERED: {
        referencesGlobalAll: true,
        type1Rows: [
            {
                code: "NR1",
                label: "“Delivered” but not received — steps & expectations",
                fieldKeys: ["sf_delivered_not_received_policy"],
            },
            {
                code: "NR2",
                label: "Carrier / claim expectations",
                fieldKeys: ["sf_carriers_and_tracking_policy"],
            },
        ],
        type2Bullets: T2_ORDER_SCOPED,
        type3Bullets: [
            "L1: tracking snapshot + Type-1, then always open ticket for investigation.",
            "Human handles carrier/claim.",
        ],
    },
    SHIPMENT_STUCK_OR_DELAYED: {
        referencesGlobalAll: true,
        type1Rows: [
            {
                code: "SD1",
                label: "What customer should do if shipment seems stuck",
                fieldKeys: ["sf_stuck_shipment_customer_steps"],
            },
            {
                code: "SD2",
                label: "Major delay communication",
                fieldKeys: ["sf_major_delay_communication"],
            },
            {
                code: "SD3",
                label: "Carriers reference",
                fieldKeys: ["sf_carriers_and_tracking_policy"],
            },
        ],
        type2Bullets: T2_ORDER_SCOPED,
        type3Bullets: [
            "L1: last scan + Type-1 + open ticket for ops/carrier follow-up.",
        ],
    },
    PAYMENT_PROBLEM: {
        referencesGlobalAll: true,
        type1Rows: [
            {
                code: "PP1",
                label: "Payment methods & failed payment",
                fieldKeys: ["sf_payment_methods_accepted", "sf_failed_payment_guidance"],
            },
            {
                code: "PP2",
                label: "Double charge intake",
                fieldKeys: ["sf_double_charge_intake"],
            },
            {
                code: "PP3",
                label: "Promo, tax, price adjustment",
                fieldKeys: [
                    "sf_promo_discount_rules",
                    "sf_tax_display_policy",
                    "sf_price_adjustment_policy",
                ],
            },
        ],
        type2Bullets: T2_PAYMENT,
        type3Bullets: [
            "L1: structured intake + ticket; no automated money movement.",
            "Finance/human resolves — replies follow your tone, not a fixed script.",
        ],
    },
    WARRANTY: {
        referencesGlobalAll: true,
        type1Rows: [
            {
                code: "WA1",
                label: "Warranty scope & duration",
                fieldKeys: ["sf_warranty_duration_scope"],
            },
            {
                code: "WA2",
                label: "Voiders",
                fieldKeys: ["sf_warranty_voiders"],
            },
            {
                code: "WA3",
                label: "Claim process",
                fieldKeys: ["sf_warranty_claim_process"],
            },
            {
                code: "WA4",
                label: "Supervisor escalation",
                fieldKeys: ["sf_complaint_supervisor_escalation"],
            },
        ],
        type2Bullets: T2_WARRANTY,
        type3Bullets: [
            "L1: intake + Type-1 + ticket.",
            "Human adjudicates.",
        ],
    },
    WRONG_ITEM: {
        referencesGlobalAll: true,
        type1Rows: [
            {
                code: "WI1",
                label: "Report deadline & evidence",
                fieldKeys: ["sf_wrong_item_report_deadline", "sf_wrong_item_evidence"],
            },
            {
                code: "WI2",
                label: "Remedies & carrier vs warehouse damage",
                fieldKeys: ["sf_wrong_item_remedies", "sf_damage_carrier_vs_warehouse"],
            },
            {
                code: "WI3",
                label: "Return shipping & how to start return",
                fieldKeys: ["sf_return_shipping_payer", "sf_how_to_start_return"],
            },
            {
                code: "WI4",
                label: "Returns policy link",
                fieldKeys: ["sf_policy_link_returns"],
            },
        ],
        type2Bullets: T2_WRONG_ITEM,
        type3Bullets: [
            "L1: acknowledgement + Type-1 + ticket with structured fields.",
            "Human executes reship/refund/return.",
        ],
    },
}

/** Short labels for textarea placeholders (from vendor doc §5). */
export const SHARED_FIELD_SHORT_LABEL: Record<string, string> = {
    sf_shipping_regions_served: "Where you ship",
    sf_shipping_regions_excluded: "Where you do not ship",
    sf_shipping_methods_and_transit: "Methods & transit ranges",
    sf_shipping_cost_model: "Free / paid / flat / dynamic",
    sf_processing_time_before_ship: "Handling time before shipment",
    sf_major_delay_communication: "What you say for major delays / backlog",
    sf_carriers_and_tracking_policy: "Carriers & when tracking appears",
    sf_dispatch_cutoff: "Same-day dispatch rules",
    sf_customs_duties_policy: "Duties / international disclaimer",
    sf_order_id_help: "How customers find order #",
    sf_first_message_checklist: "What to include when contacting support",
    sf_return_window: "Return window",
    sf_return_condition_requirements: "Condition requirements",
    sf_non_returnable_categories: "Non-returnable categories",
    sf_return_shipping_payer: "Who pays return shipping",
    sf_exchange_policy: "Exchange vs credit vs refund",
    sf_how_to_start_return: "How to start a return",
    sf_refund_methods: "Refund methods",
    sf_refund_timeline_after_approval: "Timeline after approval",
    sf_partial_refund_rules: "Partial refund rules",
    sf_store_credit_rules: "Store credit rules",
    sf_payment_methods_accepted: "Payment methods accepted",
    sf_failed_payment_guidance: "What customer should retry",
    sf_promo_discount_rules: "Promo / discount rules",
    sf_tax_display_policy: "Tax display at checkout",
    sf_price_adjustment_policy: "Price match / adjustments",
    sf_policy_link_terms: "Terms of sale URL",
    sf_policy_link_privacy: "Privacy policy URL",
    sf_policy_link_returns: "Returns policy URL",
    sf_support_channels: "Support channels & hours",
    sf_support_first_response_sla: "First response SLA",
    sf_tone_and_words_to_avoid: "Tone & words to avoid",
    sf_feedback_csat_process: "CSAT / survey process",
    sf_physical_locations_hours: "Locations & hours",
    sf_pickup_rules: "Pickup rules",
    sf_instore_vs_online_inventory: "In-store vs online stock",
    sf_sizing_fit_guidance: "Sizing & fit / size chart",
    sf_compatibility_notes: "Compatibility",
    sf_materials_care_limitations: "Materials & care",
    sf_human_escalation_when: "When to ask a human",
    sf_cancellation_window: "Cancellation window",
    sf_cancellation_how_to_request: "How to request cancel",
    sf_cancellation_preorder_digital: "Pre-order / digital cancel rules",
    sf_order_change_allowed_until: "Until when edits are possible",
    sf_order_change_how_to_request: "How to request a change",
    sf_order_change_not_possible_next_step: "After cutoff / shipped — what you say",
    sf_order_summary_tax_invoice_note: "Tax / invoice / VAT note",
    sf_delivered_not_received_policy: "Delivered but not received",
    sf_stuck_shipment_customer_steps: "Stuck shipment — customer steps",
    sf_double_charge_intake: "Double charge — what to send",
    sf_wrong_item_report_deadline: "Wrong item report deadline",
    sf_wrong_item_evidence: "Evidence (photos, etc.)",
    sf_wrong_item_remedies: "Remedies you offer",
    sf_damage_carrier_vs_warehouse: "Carrier vs warehouse damage",
    sf_warranty_duration_scope: "Warranty length & scope",
    sf_warranty_voiders: "Warranty voiders",
    sf_warranty_claim_process: "Warranty claim process",
    sf_complaint_acknowledgement_sla: "Complaint acknowledgement SLA",
    sf_complaint_supervisor_escalation: "When a lead reviews",
    sf_abusive_contact_policy: "Abusive contact boundary",
    sf_back_in_stock_policy: "Back in stock / notify",
    sf_preorder_policy: "Pre-order policy",
    sf_discontinued_product_policy: "Discontinued products",
}

export function collectFieldKeysForModule(mod: Exclude<L1Module, "UNKNOWN">): string[] {
    const spec = MODULE_THREE_TYPES[mod]
    const s = new Set<string>()
    for (const row of spec.type1Rows) {
        for (const k of row.fieldKeys) s.add(k)
    }
    return Array.from(s)
}

export function formatSharedFieldsForModule(
    mod: L1Module,
    answers: Record<string, string>,
): string {
    if (mod === "UNKNOWN") return ""
    const keys = collectFieldKeysForModule(mod)
    if (!keys.length) return ""
    const lines: string[] = []
    for (const k of keys) {
        const v = answers[k]?.trim()
        if (v) {
            const lab = SHARED_FIELD_SHORT_LABEL[k] || k
            lines.push(`${lab} (${k}): ${v}`)
        }
    }
    return lines.length ? `Module policy (Type 1 — ${mod}):\n${lines.join("\n")}` : ""
}
