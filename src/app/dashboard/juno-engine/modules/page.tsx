"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { useTheme } from "@/components/ThemeProvider"
import { cn } from "@/lib/utils"
import {
    moduleAnyEnabled,
    parseAiModulesJson,
    serializeAiModules,
    type AutomationFlags,
    type AutomationKey,
} from "@/lib/ai/orchestrator/aiModules"
import { automationRowsForModule } from "@/lib/ai/orchestrator/moduleAutomationUi"
import {
    L1_MODULE_CARD_TITLE,
    L1_MODULE_CUSTOMER_LABEL,
    L1_TICKET_MODULES_UI,
} from "@/lib/ai/orchestrator/vendorModuleGroups"
import type { L1Module } from "@/lib/ai/orchestrator/types"
import { L1_MODULE_IDS } from "@/lib/ai/orchestrator/types"
import {
    MODULE_THREE_TYPES,
    SHARED_FIELD_SHORT_LABEL,
} from "@/lib/ai/orchestrator/moduleThreeTypes"
import { parseSharedFieldAnswersJson, sharedFieldAnswersPayload } from "@/lib/kb/sharedFieldAnswers"
import { KNOWLEDGE_TEMPLATE_ANSWER_MAX } from "@/lib/kb/knowledgeTemplate"
import {
    ChevronRight,
    HelpCircle,
    Info,
    Layers,
    Loader2,
    MapPin,
    Package,
    Ruler,
    Save,
    ShieldAlert,
    ThumbsUp,
    UserCircle,
    X,
} from "lucide-react"

const FAQ_CARD_ID = "faq"
const CATEGORY_CARD_ID = "category_metadetails"

/** Single grid order — no section groupings on the dashboard. */
const DASHBOARD_CARD_ORDER: Array<
    typeof FAQ_CARD_ID | typeof CATEGORY_CARD_ID | Exclude<L1Module, "UNKNOWN">
> = [
    FAQ_CARD_ID,
    CATEGORY_CARD_ID,
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
]

function stripDocRefs(text: string) {
    return text.replace(/\s*\(§[^)]*\)/g, "").trim()
}

function categoryAutomation(on: boolean): AutomationFlags {
    return { knowledge: false, verifiedLookup: on, ticket: false }
}

type ModalId = typeof FAQ_CARD_ID | typeof CATEGORY_CARD_ID | Exclude<L1Module, "UNKNOWN"> | null

const ALL_MODAL_MODULES = new Set<L1Module>(L1_MODULE_IDS)

function isModuleModalId(id: string): id is Exclude<L1Module, "UNKNOWN"> {
    return ALL_MODAL_MODULES.has(id as L1Module) && id !== "UNKNOWN"
}

function moduleIcon(m: Exclude<L1Module, "UNKNOWN">) {
    switch (m) {
        case "CATEGORY_METADETAILS":
            return Layers
        case "STORE_LOCAL":
            return MapPin
        case "FEEDBACK":
            return ThumbsUp
        case "HUMAN_ESCALATION":
            return UserCircle
        case "PRODUCT_FIT":
            return Ruler
        case "INVENTORY_STOCK":
            return Package
        default:
            if ((L1_TICKET_MODULES_UI as readonly string[]).includes(m)) return ShieldAlert
            return Package
    }
}

export default function JunoEngineModulesPage() {
    const { theme } = useTheme()
    const isLight = theme === "light"

    const [mounted, setMounted] = useState(false)
    const [activeStoreId, setActiveStoreId] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [toast, setToast] = useState<string | null>(null)
    const [mods, setMods] = useState<Record<L1Module, AutomationFlags>>(() =>
        parseAiModulesJson(null),
    )
    const [sharedFields, setSharedFields] = useState<Record<string, string>>({})
    const [categoryMetaEnabled, setCategoryMetaEnabled] = useState(false)
    const [modalId, setModalId] = useState<ModalId>(null)
    const [modalSaveError, setModalSaveError] = useState<string | null>(null)

    const [moduleInfoOpen, setModuleInfoOpen] = useState(false)

    const load = useCallback(async (storeId: string) => {
        const res = await fetch(`/api/stores/${encodeURIComponent(storeId)}`)
        const raw = await res.json().catch(() => ({}))
        const errBody = raw as { message?: string }
        if (!res.ok) {
            throw new Error(
                typeof errBody.message === "string" && errBody.message.trim()
                    ? errBody.message
                    : res.status === 401
                      ? "Sign in again to load store settings."
                      : "Failed to load store settings",
            )
        }
        const data = raw as {
            aiModules?: unknown
            sharedFieldAnswers?: unknown
            categoryMetadetailsEnabled?: boolean
        }
        const parsedMods = parseAiModulesJson(data.aiModules)
        const catOn = Boolean(data.categoryMetadetailsEnabled)
        parsedMods.CATEGORY_METADETAILS = categoryAutomation(catOn)
        setMods(parsedMods)
        setCategoryMetaEnabled(catOn)
        setSharedFields(parseSharedFieldAnswersJson(data.sharedFieldAnswers))
    }, [])

    useEffect(() => {
        setMounted(true)
    }, [])

    useEffect(() => {
        let cancelled = false
            ; (async () => {
                try {
                    const res = await fetch("/api/stores")
                    if (!res.ok) return
                    const data = (await res.json()) as {
                        stores?: { id: string; isActive: boolean }[]
                    }
                    const active = (data.stores || []).find((s) => s.isActive)
                    if (!cancelled) setActiveStoreId(active?.id ?? null)
                } catch {
                    if (!cancelled) setActiveStoreId(null)
                }
            })()
        return () => {
            cancelled = true
        }
    }, [])

    useEffect(() => {
        if (!activeStoreId) {
            setLoading(false)
            return
        }
        let cancelled = false
            ; (async () => {
                try {
                    setLoading(true)
                    setToast(null)
                    await load(activeStoreId)
                } catch (e) {
                    if (!cancelled) setToast(e instanceof Error ? e.message : "Load failed")
                } finally {
                    if (!cancelled) setLoading(false)
                }
            })()
        return () => {
            cancelled = true
        }
    }, [activeStoreId, load])

    useEffect(() => {
        if (!modalId) return
        setModalSaveError(null)
        setModuleInfoOpen(false)
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setModalId(null)
        }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [modalId])

    useEffect(() => {
        if (modalId) {
            document.body.style.overflow = "hidden"
        } else {
            document.body.style.overflow = ""
        }
        return () => {
            document.body.style.overflow = ""
        }
    }, [modalId])

    async function saveChanges(): Promise<{ ok: boolean; error?: string }> {
        if (!activeStoreId) return { ok: false, error: "No store selected" }
        setSaving(true)
        setToast(null)
        try {
            const mergedMods: Record<L1Module, AutomationFlags> = {
                ...mods,
                CATEGORY_METADETAILS: categoryAutomation(categoryMetaEnabled),
            }
            const res = await fetch(`/api/stores/${encodeURIComponent(activeStoreId)}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    aiModules: serializeAiModules(mergedMods),
                    categoryMetadetailsEnabled: categoryMetaEnabled,
                    sharedFieldAnswers: sharedFieldAnswersPayload(sharedFields),
                }),
            })
            const j = (await res.json().catch(() => ({}))) as {
                message?: string
                aiModules?: unknown
                sharedFieldAnswers?: unknown
                categoryMetadetailsEnabled?: boolean
            }
            if (!res.ok) throw new Error(j.message || "Save failed")
            const nextMods = parseAiModulesJson(j.aiModules ?? serializeAiModules(mergedMods))
            const catOn = Boolean(j.categoryMetadetailsEnabled)
            nextMods.CATEGORY_METADETAILS = categoryAutomation(catOn)
            setMods(nextMods)
            setCategoryMetaEnabled(catOn)
            setSharedFields(parseSharedFieldAnswersJson(j.sharedFieldAnswers))
            setToast("Saved.")
            return { ok: true }
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Save failed"
            setToast(msg)
            return { ok: false, error: msg }
        } finally {
            setSaving(false)
        }
    }

    const faqOn = mods.FAQ.knowledge
    const categoryOn = categoryMetaEnabled

    function setAutomation(mod: L1Module, key: AutomationKey, value: boolean) {
        setMods((prev) => ({
            ...prev,
            [mod]: { ...prev[mod], [key]: value },
        }))
    }

    const modalModule: Exclude<L1Module, "UNKNOWN"> | null =
        modalId && isModuleModalId(modalId) ? modalId : null

    const cardShell = cn(
        "rounded-xl border min-w-0 transition-all cursor-pointer text-left w-full",
        isLight
            ? "border-slate-200 bg-white shadow-sm hover:bg-slate-50/90 hover:border-slate-300 hover:shadow"
            : "bg-white/5 border-white/10 hover:bg-white/[0.08] hover:border-indigo-500/30",
    )

    const iconWrap = cn(
        "w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border",
        isLight
            ? "bg-indigo-50 border-indigo-100 text-indigo-600"
            : "bg-indigo-500/15 border-indigo-400/20 text-indigo-400",
    )

    const badgeCls = (active: boolean) =>
        cn(
            "text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md shrink-0",
            active
                ? isLight
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-emerald-500/20 text-emerald-400"
                : isLight
                  ? "bg-slate-100 text-slate-500"
                  : "bg-white/10 text-slate-400",
        )

    const panelClass = isLight
        ? "bg-white border-slate-200 text-slate-900 shadow-xl"
        : "bg-slate-900/98 border-white/10 text-white shadow-2xl backdrop-blur-xl"

    const inputSurface = isLight
        ? "bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400"
        : "bg-black/30 border-white/10 text-white placeholder:text-slate-500"

    function renderPolicyFields(mod: Exclude<L1Module, "UNKNOWN">) {
        const spec = MODULE_THREE_TYPES[mod]
        const subtle = isLight ? "text-slate-600" : "text-slate-400"
        const rowBorder = isLight ? "border-slate-200 bg-slate-50/50" : "border-white/10 bg-white/[0.03]"
        return (
            <div className="space-y-5">
                {spec.referencesGlobalAll ? (
                    <p className={cn("text-xs leading-relaxed", subtle)}>
                        Global store voice (G1–G12) lives in the{" "}
                        <Link
                            href="/dashboard/juno-engine/knowledge-base"
                            className="font-semibold text-indigo-500 hover:underline"
                        >
                            Knowledge base
                        </Link>
                        . Fields below are shared wherever the same keys appear.
                    </p>
                ) : null}

                {spec.type1Rows.length > 0 ? (
                    <>
                        <p className={cn("text-xs", subtle)}>
                            Policy and messaging your customers may see (together with the knowledge base).
                        </p>
                        {spec.type1Rows.map((row) => (
                            <div
                                key={row.code}
                                className={cn("space-y-3 rounded-xl border p-4", rowBorder)}
                            >
                                <p
                                    className={cn(
                                        "text-sm font-semibold",
                                        isLight ? "text-slate-900" : "text-white",
                                    )}
                                >
                                    {row.label}
                                </p>
                                {row.fieldKeys.map((fk) => (
                                    <div key={fk} className="space-y-1.5">
                                        <label
                                            className={cn(
                                                "text-[11px] font-semibold uppercase tracking-wide",
                                                isLight ? "text-slate-600" : "text-slate-400",
                                            )}
                                        >
                                            {SHARED_FIELD_SHORT_LABEL[fk] || fk}
                                        </label>
                                        <textarea
                                            value={sharedFields[fk] ?? ""}
                                            onChange={(e) =>
                                                setSharedFields((s) => ({
                                                    ...s,
                                                    [fk]: e.target.value.slice(0, KNOWLEDGE_TEMPLATE_ANSWER_MAX),
                                                }))
                                            }
                                            rows={3}
                                            maxLength={KNOWLEDGE_TEMPLATE_ANSWER_MAX}
                                            disabled={saving}
                                            className={cn(
                                                "w-full px-3 py-2 rounded-lg border text-sm resize-y min-h-[72px] focus:outline-none focus:ring-2 focus:ring-indigo-500/30",
                                                inputSurface,
                                            )}
                                        />
                                    </div>
                                ))}
                            </div>
                        ))}
                    </>
                ) : null}
            </div>
        )
    }

    function renderModuleInfoPanel(mod: Exclude<L1Module, "UNKNOWN">) {
        const spec = MODULE_THREE_TYPES[mod]
        const subtle = isLight ? "text-slate-600" : "text-slate-400"
        const hasInfo = spec.type2Bullets.length > 0 || spec.type3Bullets.length > 0
        if (!hasInfo) return null
        return (
            <div
                className={cn(
                    "rounded-xl border p-4 text-xs space-y-4 max-h-[min(60vh,420px)] overflow-y-auto shadow-lg",
                    isLight ? "border-slate-200 bg-white text-slate-800" : "border-white/15 bg-slate-900 text-slate-200",
                )}
            >
                <p className={cn("font-semibold", isLight ? "text-slate-900" : "text-white")}>
                    How verification &amp; automation work
                </p>
                <p className={subtle}>
                    Platform behavior only — you don&apos;t write agent scripts here. Tone still comes from your
                    policy fields above and the knowledge base.
                </p>
                {spec.type2Bullets.length > 0 ? (
                    <div className="space-y-2">
                        <p className={cn("font-medium", isLight ? "text-slate-800" : "text-slate-100")}>
                            Verification &amp; prerequisites
                        </p>
                        <ul className={cn("list-disc pl-4 space-y-1.5 leading-relaxed", subtle)}>
                            {spec.type2Bullets.map((b, i) => (
                                <li key={i}>{stripDocRefs(b)}</li>
                            ))}
                        </ul>
                    </div>
                ) : null}
                {spec.type3Bullets.length > 0 ? (
                    <div className="space-y-2">
                        <p className={cn("font-medium", isLight ? "text-slate-800" : "text-slate-100")}>
                            L1 answers &amp; ticketing
                        </p>
                        <ul className={cn("list-disc pl-4 space-y-1.5 leading-relaxed", subtle)}>
                            {spec.type3Bullets.map((b, i) => (
                                <li key={i}>{stripDocRefs(b)}</li>
                            ))}
                        </ul>
                    </div>
                ) : null}
            </div>
        )
    }

    function renderAutomationRows(mod: Exclude<L1Module, "UNKNOWN">) {
        const rowSurface = isLight
            ? "border-slate-200 bg-slate-50/60"
            : "border-white/10 bg-white/[0.04]"
        return (
            <div className="space-y-3">
                {automationRowsForModule(mod).map((row) => {
                    const checked = row.lockedOn ? true : mods[mod][row.key]
                    return (
                        <div
                            key={row.key}
                            className={cn(
                                "flex items-start justify-between gap-4 rounded-xl border px-4 py-3",
                                rowSurface,
                            )}
                        >
                            <div className="min-w-0 flex-1">
                                <p
                                    className={cn(
                                        "text-sm font-semibold leading-snug",
                                        isLight ? "text-slate-900" : "text-white",
                                    )}
                                >
                                    {row.label}
                                </p>
                                {row.subtitle ? (
                                    <p
                                        className={cn(
                                            "text-xs mt-1 leading-relaxed",
                                            isLight ? "text-slate-600" : "text-slate-400",
                                        )}
                                    >
                                        {row.subtitle}
                                    </p>
                                ) : null}
                                {row.lockedOn ? (
                                    <p
                                        className={cn(
                                            "text-[11px] mt-1.5 font-medium uppercase tracking-wide",
                                            isLight ? "text-slate-500" : "text-slate-500",
                                        )}
                                    >
                                        Always on for safety
                                    </p>
                                ) : null}
                            </div>
                            <label className="shrink-0 cursor-pointer pt-0.5">
                                <input
                                    type="checkbox"
                                    className="rounded border-slate-500 w-4 h-4 accent-indigo-600"
                                    checked={checked}
                                    disabled={saving || row.lockedOn}
                                    onChange={(e) => {
                                        if (row.lockedOn) return
                                        setAutomation(mod, row.key, e.target.checked)
                                        if (mod === "CATEGORY_METADETAILS" && row.key === "verifiedLookup") {
                                            setCategoryMetaEnabled(e.target.checked)
                                        }
                                    }}
                                    aria-label={`Toggle ${row.label}`}
                                />
                            </label>
                        </div>
                    )
                })}
            </div>
        )
    }

    function renderModuleCard(m: Exclude<L1Module, "UNKNOWN">) {
        const Icon = moduleIcon(m)
        const on = moduleAnyEnabled(mods[m])
        return (
            <button
                type="button"
                className={cardShell}
                onClick={() => setModalId(m)}
            >
                <span className="p-5 flex items-start gap-4 w-full">
                    <span className={iconWrap}>
                        <Icon className="w-5 h-5" />
                    </span>
                    <span className="flex-1 min-w-0 text-left">
                        <span
                            className={cn(
                                "font-black text-base leading-tight block",
                                isLight ? "text-slate-900" : "text-white",
                            )}
                        >
                            {L1_MODULE_CARD_TITLE[m]}
                        </span>
                        <span
                            className={cn(
                                "text-xs mt-1 line-clamp-2 block",
                                isLight ? "text-slate-500" : "text-slate-400",
                            )}
                        >
                            {L1_MODULE_CUSTOMER_LABEL[m]}
                        </span>
                    </span>
                    <span className={badgeCls(on)}>{on ? "On" : "Off"}</span>
                    <ChevronRight className="w-5 h-5 shrink-0 text-slate-400 self-center" />
                </span>
            </button>
        )
    }

    const infoSpecMod: Exclude<L1Module, "UNKNOWN"> | null =
        modalId === FAQ_CARD_ID
            ? "FAQ"
            : modalId === CATEGORY_CARD_ID
              ? "CATEGORY_METADETAILS"
              : modalModule

    const hasModuleInfoPanel =
        infoSpecMod &&
        (MODULE_THREE_TYPES[infoSpecMod].type2Bullets.length > 0 ||
            MODULE_THREE_TYPES[infoSpecMod].type3Bullets.length > 0)

    const modal =
        mounted &&
        modalId &&
        createPortal(
            <div
                className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4"
                role="dialog"
                aria-modal="true"
                aria-labelledby="module-modal-title"
            >
                <button
                    type="button"
                    className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                    aria-label="Close"
                    onClick={() => setModalId(null)}
                />
                <div
                    className={cn(
                        "relative flex max-h-[min(92vh,900px)] w-full flex-col rounded-t-2xl border sm:rounded-2xl sm:max-w-2xl",
                        panelClass,
                    )}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div
                        className={cn(
                            "flex items-start justify-between gap-3 px-5 py-4 border-b shrink-0",
                            isLight ? "border-slate-100" : "border-white/10",
                        )}
                    >
                        <div className="min-w-0 flex-1 pr-2">
                            <h2
                                id="module-modal-title"
                                className={cn(
                                    "text-lg font-bold tracking-tight",
                                    isLight ? "text-slate-900" : "text-white",
                                )}
                            >
                                {modalId === FAQ_CARD_ID
                                    ? L1_MODULE_CARD_TITLE.FAQ
                                    : modalId === CATEGORY_CARD_ID
                                      ? L1_MODULE_CARD_TITLE.CATEGORY_METADETAILS
                                      : modalModule
                                        ? L1_MODULE_CARD_TITLE[modalModule]
                                        : "Module"}
                            </h2>
                            <p
                                className={cn(
                                    "text-xs mt-1",
                                    isLight ? "text-slate-500" : "text-slate-400",
                                )}
                            >
                                {modalId === FAQ_CARD_ID
                                    ? L1_MODULE_CUSTOMER_LABEL.FAQ
                                    : modalId === CATEGORY_CARD_ID
                                      ? L1_MODULE_CUSTOMER_LABEL.CATEGORY_METADETAILS
                                      : modalModule
                                        ? L1_MODULE_CUSTOMER_LABEL[modalModule]
                                        : ""}
                            </p>
                        </div>
                        <div className="flex items-start gap-1 shrink-0 relative">
                            {hasModuleInfoPanel && infoSpecMod ? (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => setModuleInfoOpen((v) => !v)}
                                        className={cn(
                                            "p-2 rounded-lg transition-colors",
                                            moduleInfoOpen
                                                ? isLight
                                                    ? "bg-indigo-100 text-indigo-700"
                                                    : "bg-indigo-500/20 text-indigo-300"
                                                : isLight
                                                  ? "hover:bg-slate-100 text-slate-500"
                                                  : "hover:bg-white/10 text-slate-400",
                                        )}
                                        aria-expanded={moduleInfoOpen}
                                        aria-label="Verification and automation details"
                                    >
                                        <Info className="w-5 h-5" />
                                    </button>
                                    {moduleInfoOpen ? (
                                        <div className="absolute right-0 top-full z-[220] mt-2 w-[min(calc(100vw-2rem),22rem)]">
                                            {renderModuleInfoPanel(infoSpecMod)}
                                        </div>
                                    ) : null}
                                </>
                            ) : null}
                            <button
                                type="button"
                                onClick={() => setModalId(null)}
                                className={cn(
                                    "p-2 rounded-lg transition-colors",
                                    isLight
                                        ? "hover:bg-slate-100 text-slate-500"
                                        : "hover:bg-white/10 text-slate-400",
                                )}
                                aria-label="Close"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-5 py-4 space-y-6">
                        {modalId === FAQ_CARD_ID ? (
                            <>
                                {renderAutomationRows("FAQ")}
                                {renderPolicyFields("FAQ")}
                            </>
                        ) : modalId === CATEGORY_CARD_ID ? (
                            <>
                                {renderAutomationRows("CATEGORY_METADETAILS")}
                                {renderPolicyFields("CATEGORY_METADETAILS")}
                            </>
                        ) : modalModule ? (
                            <>
                                {renderAutomationRows(modalModule)}
                                {renderPolicyFields(modalModule)}
                            </>
                        ) : null}
                    </div>

                    {modalSaveError ? (
                        <p
                            className={cn(
                                "px-5 py-2 text-xs border-t",
                                isLight
                                    ? "border-amber-100 bg-amber-50 text-amber-900"
                                    : "border-amber-500/20 bg-amber-500/10 text-amber-200",
                            )}
                        >
                            {modalSaveError}
                        </p>
                    ) : null}
                    <div
                        className={cn(
                            "flex flex-wrap items-center justify-end gap-2 px-5 py-3 border-t shrink-0",
                            isLight ? "border-slate-100 bg-slate-50/80" : "border-white/10 bg-slate-950/50",
                        )}
                    >
                        <button
                            type="button"
                            onClick={() => setModalId(null)}
                            className={cn(
                                "px-4 py-2 rounded-lg text-sm font-medium",
                                isLight
                                    ? "text-slate-600 hover:bg-slate-200/80"
                                    : "text-slate-300 hover:bg-white/10",
                            )}
                        >
                            Close
                        </button>
                        <button
                            type="button"
                            disabled={saving}
                            onClick={() =>
                                void (async () => {
                                    setModalSaveError(null)
                                    const r = await saveChanges()
                                    if (r.ok) setModalId(null)
                                    else if (r.error) setModalSaveError(r.error)
                                })()
                            }
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold disabled:opacity-50"
                        >
                            {saving ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Save className="w-4 h-4" />
                            )}
                            Save changes
                        </button>
                    </div>
                </div>
            </div>,
            document.body,
        )

    return (
        <div className="flex w-full flex-col gap-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1 space-y-1">
                    <h1
                        className={cn(
                            "text-2xl md:text-3xl font-extrabold tracking-tight",
                            isLight ? "text-slate-900" : "text-white",
                        )}
                    >
                        AI modules
                    </h1>
                    <p
                        className={cn(
                            "text-sm max-w-2xl",
                            isLight ? "text-slate-600" : "text-slate-400",
                        )}
                    >
                        Open a module to turn each automation on or off and edit policy fields. Use the{" "}
                        <span className="font-semibold">info</span> icon in the dialog for how verification
                        and ticketing work on the platform. Global voice:{" "}
                        <Link
                            href="/dashboard/juno-engine/knowledge-base"
                            className="font-semibold text-indigo-500 hover:underline"
                        >
                            Knowledge base
                        </Link>
                        .
                    </p>
                    <p
                        className={cn(
                            "text-xs pt-1",
                            isLight ? "text-slate-500" : "text-slate-500",
                        )}
                    >
                        Changes are local until you save.
                    </p>
                </div>
                {activeStoreId && !loading ? (
                    <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
                        {toast ? (
                            <p
                                className={cn(
                                    "max-w-xs text-right text-xs sm:max-w-sm",
                                    toast.includes("fail") || toast.includes("Failed")
                                        ? isLight
                                            ? "text-amber-700"
                                            : "text-amber-400"
                                        : isLight
                                          ? "text-emerald-700"
                                          : "text-emerald-400/90",
                                )}
                            >
                                {toast}
                            </p>
                        ) : null}
                        <button
                            type="button"
                            disabled={saving}
                            onClick={() => void saveChanges()}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-900/20 hover:bg-indigo-700 disabled:opacity-50 sm:min-w-[10rem]"
                        >
                            {saving ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Save className="h-4 w-4" />
                            )}
                            Save changes
                        </button>
                    </div>
                ) : null}
            </div>

            {!activeStoreId ? (
                <p className={cn("text-sm", isLight ? "text-slate-500" : "text-slate-400")}>
                    Select an active store to configure modules.
                </p>
            ) : loading ? (
                <div className="flex items-center gap-2 text-sm text-slate-400 py-12">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Loading…
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6 content-start">
                        {DASHBOARD_CARD_ORDER.map((key) => {
                            if (key === FAQ_CARD_ID) {
                                return (
                                    <button
                                        key={key}
                                        type="button"
                                        className={cardShell}
                                        onClick={() => setModalId(FAQ_CARD_ID)}
                                    >
                                        <span className="p-5 flex items-start gap-4 w-full">
                                            <span className={iconWrap}>
                                                <HelpCircle className="w-5 h-5" />
                                            </span>
                                            <span className="flex-1 min-w-0 text-left">
                                                <span
                                                    className={cn(
                                                        "font-black text-base leading-tight block",
                                                        isLight ? "text-slate-900" : "text-white",
                                                    )}
                                                >
                                                    {L1_MODULE_CARD_TITLE.FAQ}
                                                </span>
                                                <span
                                                    className={cn(
                                                        "text-xs mt-1 line-clamp-2 block",
                                                        isLight ? "text-slate-500" : "text-slate-400",
                                                    )}
                                                >
                                                    {L1_MODULE_CUSTOMER_LABEL.FAQ}
                                                </span>
                                            </span>
                                            <span className={badgeCls(faqOn)}>{faqOn ? "On" : "Off"}</span>
                                            <ChevronRight className="w-5 h-5 shrink-0 text-slate-400 self-center" />
                                        </span>
                                    </button>
                                )
                            }
                            if (key === CATEGORY_CARD_ID) {
                                return (
                                    <button
                                        key={key}
                                        type="button"
                                        className={cardShell}
                                        onClick={() => setModalId(CATEGORY_CARD_ID)}
                                    >
                                        <span className="p-5 flex items-start gap-4 w-full">
                                            <span className={iconWrap}>
                                                <Layers className="w-5 h-5" />
                                            </span>
                                            <span className="flex-1 min-w-0 text-left">
                                                <span
                                                    className={cn(
                                                        "font-black text-base leading-tight block",
                                                        isLight ? "text-slate-900" : "text-white",
                                                    )}
                                                >
                                                    {L1_MODULE_CARD_TITLE.CATEGORY_METADETAILS}
                                                </span>
                                                <span
                                                    className={cn(
                                                        "text-xs mt-1 line-clamp-2 block",
                                                        isLight ? "text-slate-500" : "text-slate-400",
                                                    )}
                                                >
                                                    {L1_MODULE_CUSTOMER_LABEL.CATEGORY_METADETAILS}
                                                </span>
                                            </span>
                                            <span className={badgeCls(categoryOn)}>
                                                {categoryOn ? "On" : "Off"}
                                            </span>
                                            <ChevronRight className="w-5 h-5 shrink-0 text-slate-400 self-center" />
                                        </span>
                                    </button>
                                )
                            }
                            return (
                                <div key={key} className="contents">
                                    {renderModuleCard(key)}
                                </div>
                            )
                        })}
                    </div>

                    {modal}
                </>
            )}
        </div>
    )
}
