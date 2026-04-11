import {
    L1_MODULE_CARD_TITLE,
    L1_MODULE_CUSTOMER_LABEL,
    modulePillar,
} from "@/lib/ai/orchestrator/vendorModuleGroups"
import type { L1Module } from "@/lib/ai/orchestrator/types"
import type { AutomationKey } from "@/lib/ai/orchestrator/aiModules"

export type UiAutomationRow = {
    key: AutomationKey
    label: string
    subtitle?: string
    /** When true, checkbox is on and disabled (platform requirement). */
    lockedOn?: boolean
}

type VendorModule = Exclude<L1Module, "UNKNOWN">

export function automationRowsForModule(mod: VendorModule): UiAutomationRow[] {
    const pillar = modulePillar(mod)
    const cardTitle = L1_MODULE_CARD_TITLE[mod]
    const customer = L1_MODULE_CUSTOMER_LABEL[mod]

    if (mod === "CATEGORY_METADETAILS") {
        return [
            {
                key: "verifiedLookup",
                label: "Use category fields from your synced catalog",
                subtitle:
                    "When on, product-fit answers may use category metadetails from your database when tools provide them.",
            },
        ]
    }

    if (pillar === "K") {
        return [
            {
                key: "knowledge",
                label: `Automated answers — ${cardTitle}`,
                subtitle: customer,
            },
        ]
    }

    if (pillar === "T") {
        return [
            {
                key: "verifiedLookup",
                label: `Verified data lookup — ${cardTitle}`,
                subtitle:
                    "Uses live order or product data after the shopper matches inbox email or completes chat verification.",
            },
            {
                key: "ticket",
                label: `Support ticket when automation can’t finish — ${cardTitle}`,
                subtitle:
                    "If data is missing or unclear, hand off to your team instead of only replying from the knowledge base.",
            },
        ]
    }

    // X — ticket pillar
    return [
        {
            key: "verifiedLookup",
            label: "Verify identity before a ticket",
            subtitle: "Email match on inbound mail, or email + OTP on the storefront widget.",
            lockedOn: true,
        },
        {
            key: "ticket",
            label: `Support ticket — ${cardTitle}`,
            subtitle: customer,
        },
    ]
}
