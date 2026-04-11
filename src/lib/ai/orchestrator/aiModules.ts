import type { L1Module } from "@/lib/ai/orchestrator/types"
import { L1_MODULE_IDS } from "@/lib/ai/orchestrator/types"
import type { L1Pillar } from "@/lib/ai/orchestrator/types"
import { modulePillar } from "@/lib/ai/orchestrator/vendorModuleGroups"

export type AutomationKey = "knowledge" | "verifiedLookup" | "ticket"

export type AutomationFlags = Record<AutomationKey, boolean>

const ALL_OFF: AutomationFlags = {
    knowledge: false,
    verifiedLookup: false,
    ticket: false,
}

const ALL_ON: AutomationFlags = {
    knowledge: true,
    verifiedLookup: true,
    ticket: true,
}

function pillarDefaults(pillar: L1Pillar): AutomationFlags {
    if (pillar === "K") {
        return { knowledge: true, verifiedLookup: false, ticket: false }
    }
    if (pillar === "T") {
        return { knowledge: false, verifiedLookup: true, ticket: false }
    }
    return { knowledge: false, verifiedLookup: true, ticket: true }
}

function categoryDefaults(on: boolean): AutomationFlags {
    return on
        ? { knowledge: false, verifiedLookup: true, ticket: false }
        : ALL_OFF
}

function normalizeModuleValue(mod: L1Module, raw: unknown): AutomationFlags {
    if (mod === "UNKNOWN") {
        return ALL_ON
    }

    if (mod === "CATEGORY_METADETAILS") {
        if (raw === false) return ALL_OFF
        if (raw === true || raw == null) return categoryDefaults(true)
        if (typeof raw === "object" && raw !== null && !Array.isArray(raw)) {
            const o = raw as Record<string, unknown>
            const base = categoryDefaults(true)
            return {
                knowledge: typeof o.knowledge === "boolean" ? o.knowledge : base.knowledge,
                verifiedLookup:
                    typeof o.verifiedLookup === "boolean" ? o.verifiedLookup : base.verifiedLookup,
                ticket: typeof o.ticket === "boolean" ? o.ticket : base.ticket,
            }
        }
        return categoryDefaults(true)
    }

    const pillar = modulePillar(mod)
    const d = pillarDefaults(pillar)

    let result: AutomationFlags
    if (raw === false) {
        result = ALL_OFF
    } else if (raw === true || raw == null) {
        result = { ...d }
    } else if (typeof raw === "object" && raw !== null && !Array.isArray(raw)) {
        const o = raw as Record<string, unknown>
        result = {
            knowledge: typeof o.knowledge === "boolean" ? o.knowledge : d.knowledge,
            verifiedLookup:
                typeof o.verifiedLookup === "boolean" ? o.verifiedLookup : d.verifiedLookup,
            ticket: typeof o.ticket === "boolean" ? o.ticket : d.ticket,
        }
    } else {
        result = { ...d }
    }
    if (pillar === "X" && result.ticket) {
        result = { ...result, verifiedLookup: true }
    }
    return result
}

/**
 * Parse `Store.aiModules` JSON into per-module automation flags.
 * Legacy `true` / `false` booleans map to pillar defaults or all-off.
 */
export function parseAiModulesJson(raw: unknown): Record<L1Module, AutomationFlags> {
    const o =
        raw != null && typeof raw === "object" && !Array.isArray(raw)
            ? (raw as Record<string, unknown>)
            : {}

    const out = {} as Record<L1Module, AutomationFlags>
    for (const id of L1_MODULE_IDS) {
        out[id] = normalizeModuleValue(id, o[id])
    }
    return out
}

export function moduleAnyEnabled(flags: AutomationFlags): boolean {
    return flags.knowledge || flags.verifiedLookup || flags.ticket
}

export function isModuleEnabled(
    modules: Record<L1Module, AutomationFlags>,
    module: L1Module,
): boolean {
    if (module === "UNKNOWN") return true
    return moduleAnyEnabled(modules[module])
}

export function isAutomationEnabled(
    modules: Record<L1Module, AutomationFlags>,
    module: L1Module,
    key: AutomationKey,
): boolean {
    if (module === "UNKNOWN") return true
    return Boolean(modules[module][key])
}

/** Identity gate (OTP / inbox) for transactional and ticket pillars. */
export function needsIdentityGate(pillar: L1Pillar, flags: AutomationFlags): boolean {
    if (pillar === "K") return false
    if (pillar === "X") {
        return flags.ticket
    }
    return flags.verifiedLookup || flags.ticket
}

/**
 * Serialize for PATCH: use `false`, `true`, or explicit `{ knowledge, verifiedLookup, ticket }` when non-default.
 */
export function serializeAiModules(
    modules: Record<L1Module, AutomationFlags>,
): Record<string, boolean | AutomationFlags> {
    const out: Record<string, boolean | AutomationFlags> = {}
    for (const id of L1_MODULE_IDS) {
        if (id === "UNKNOWN") continue
        const f = modules[id]
        const d = id === "CATEGORY_METADETAILS" ? categoryDefaults(true) : pillarDefaults(modulePillar(id))

        if (!moduleAnyEnabled(f)) {
            out[id] = false
            continue
        }
        if (f.knowledge === d.knowledge && f.verifiedLookup === d.verifiedLookup && f.ticket === d.ticket) {
            out[id] = true
            continue
        }
        out[id] = {
            knowledge: f.knowledge,
            verifiedLookup: f.verifiedLookup,
            ticket: f.ticket,
        }
    }
    return out
}
