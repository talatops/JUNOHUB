"use client"

import { useState, useEffect, useMemo } from "react"
import { createPortal } from "react-dom"
import { motion, AnimatePresence } from "framer-motion"
import { FileText, Search, Plus, Loader2, Edit, Trash2 } from "lucide-react"
import { renderTemplate } from "@/lib/templates/simpleRenderer"
import { useTheme } from "@/components/ThemeProvider"

type TemplateIntent = "general" | "shipping_delay" | "refund_request" | "question"
type TemplateMood = "neutral" | "angry" | "confused" | "happy"

interface Template {
    id: string
    storeId: string
    name: string
    intent: TemplateIntent | string
    mood: TemplateMood | string
    description: string | null
    body: string
    variables?: unknown
    isHtml: boolean
    updatedAt: string
}

const INTENT_OPTIONS: { value: TemplateIntent; label: string }[] = [
    { value: "general", label: "General" },
    { value: "shipping_delay", label: "Shipping delay" },
    { value: "refund_request", label: "Refund request" },
    { value: "question", label: "General question" },
]

const MOOD_OPTIONS: { value: TemplateMood; label: string }[] = [
    { value: "neutral", label: "Neutral" },
    { value: "angry", label: "Frustrated / Angry" },
    { value: "confused", label: "Confused" },
    { value: "happy", label: "Happy" },
]

const exampleContext = {
    customer_name: "Alex",
    customer_email: "alex@example.com",
    store_name: "JUNOVendor",
    store_email: "support@junovendor.com",
    subject: "Where is my order?",
    ticket_summary: "Customer is asking about a shipping delay on order #1234.",
}

export default function EmailTemplatesPage() {
    const [searchTerm, setSearchTerm] = useState("")
    const [templates, setTemplates] = useState<Template[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const [editing, setEditing] = useState<Template | null>(null)
    const [saving, setSaving] = useState(false)
    const [mounted, setMounted] = useState(false)
    const { theme } = useTheme()
    const isLight = theme === "light"

    useEffect(() => {
        setMounted(true)
    }, [])

    const loadTemplates = async () => {
        try {
            setLoading(true)
            setError(null)
            const res = await fetch("/api/juno-engine/templates", { cache: "no-store" })
            if (!res.ok) {
                throw new Error("Failed to load templates")
            }
            const data = (await res.json()) as { templates: Template[] }
            setTemplates(data.templates || [])
        } catch (err) {
            console.error(err)
            setError("Could not load templates. Please try again.")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        void loadTemplates()
    }, [])

    const filteredTemplates = useMemo(() => {
        if (!searchTerm.trim()) return templates
        const q = searchTerm.toLowerCase()
        return templates.filter((tpl) =>
            [tpl.name, tpl.intent, tpl.mood, tpl.description || ""]
                .join(" ")
                .toLowerCase()
                .includes(q),
        )
    }, [templates, searchTerm])

    const startNewTemplate = () => {
        setEditing({
            id: "",
            storeId: "",
            name: "",
            intent: "general",
            mood: "neutral",
            description: "",
            body:
                "Hi {{customer_name}},\n\nThank you for reaching out. {{ticket_summary}}\n\nBest regards,\n{{store_name}} Support Team",
            variables: undefined,
            isHtml: false,
            updatedAt: new Date().toISOString(),
        })
    }

    const startEditTemplate = (template: Template) => {
        setEditing(template)
    }

    const handleDelete = async (template: Template) => {
        if (!window.confirm(`Delete template "${template.name}"?`)) return
        try {
            const res = await fetch(
                `/api/juno-engine/templates/${encodeURIComponent(template.id)}`,
                { method: "DELETE" },
            )
            if (!res.ok) throw new Error("Failed to delete template")
            setTemplates((prev) => prev.filter((t) => t.id !== template.id))
        } catch (err) {
            console.error(err)
            alert("Failed to delete template. Please try again.")
        }
    }

    const handleSave = async () => {
        if (!editing) return
        if (!editing.name.trim()) {
            alert("Template name is required.")
            return
        }
        if (!editing.body.trim()) {
            alert("Template body is required.")
            return
        }

        try {
            setSaving(true)
            const payload = {
                name: editing.name.trim(),
                intent: editing.intent,
                mood: editing.mood,
                description: editing.description || null,
                body: editing.body,
                variables: editing.variables,
                isHtml: editing.isHtml,
            }

            if (!editing.id) {
                const res = await fetch("/api/juno-engine/templates", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                })
                if (!res.ok) throw new Error("Failed to create template")
                const data = (await res.json()) as { template: Template }
                setTemplates((prev) => [data.template, ...prev])
                setEditing(null)
            } else {
                const res = await fetch(
                    `/api/juno-engine/templates/${encodeURIComponent(editing.id)}`,
                    {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(payload),
                    },
                )
                if (!res.ok) throw new Error("Failed to update template")
                const data = (await res.json()) as { template: Template }
                setTemplates((prev) =>
                    prev.map((t) => (t.id === data.template.id ? data.template : t)),
                )
                setEditing(null)
            }
        } catch (err) {
            console.error(err)
            alert("Failed to save template. Please try again.")
        } finally {
            setSaving(false)
        }
    }

    const currentPreview = editing
        ? renderTemplate(editing.body, exampleContext)
        : ""

    return (
        <div className="h-full flex flex-col space-y-4 md:space-y-6 mt-4 md:mt-6">
            <div className={`backdrop-blur-xl rounded-xl md:rounded-2xl border overflow-hidden flex flex-col flex-1 min-h-0 ${isLight ? "bg-white border-slate-200 shadow-sm" : "bg-white/5 border-white/10"
                }`}>
                <div className={`p-4 md:p-6 border-b flex flex-col sm:flex-row gap-3 md:gap-4 justify-between flex-shrink-0 ${isLight ? "border-slate-100 bg-slate-50/50" : "border-white/10 bg-white/5"
                    }`}>
                    <div className="relative flex-1 min-w-0">
                        <Search className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Search templates by name, intent, or mood..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className={`w-full h-10 md:h-11 pl-10 md:pl-11 pr-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all text-sm font-medium ${isLight
                                ? "bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500"
                                : "bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:border-indigo-500/50"
                                }`}
                        />
                    </div>
                    <button
                        onClick={startNewTemplate}
                        className="h-10 md:h-11 px-4 bg-indigo-500 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-600 border border-indigo-400/20 transition-all text-sm shrink-0"
                    >
                        <Plus className="w-4 h-4" /> New Template
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto overflow-x-auto -mx-4 md:mx-0">
                    <div className="min-w-full px-4 md:px-0">
                        {loading ? (
                            <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-3">
                                <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
                                <p className="font-medium animate-pulse">Loading templates...</p>
                            </div>
                        ) : error ? (
                            <div className="h-64 flex flex-col items-center justify-center text-red-400 gap-3 text-center px-4">
                                <p className="font-medium">{error}</p>
                            </div>
                        ) : filteredTemplates.length === 0 ? (
                            <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-3">
                                <FileText className="w-10 h-10 opacity-20" />
                                <p className="font-medium">No email templates found.</p>
                                <p className="text-xs text-slate-500">
                                    Create your first template to get started.
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 p-4 md:p-6">
                                {filteredTemplates.map((template) => (
                                    <button
                                        key={template.id}
                                        type="button"
                                        onClick={() => startEditTemplate(template)}
                                        className={`backdrop-blur-xl p-4 md:p-6 rounded-xl md:rounded-2xl border transition-all group text-left ${isLight
                                            ? "bg-white border-slate-200 hover:bg-slate-50 hover:border-indigo-300 shadow-sm"
                                            : "bg-white/5 border-white/10 hover:bg-white/[0.07] hover:border-indigo-500/30"
                                            }`}
                                    >
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="flex-1 min-w-0">
                                                <h3 className={`font-bold text-base md:text-lg truncate group-hover:text-indigo-500 transition-colors ${isLight ? "text-slate-900" : "text-white"
                                                    }`}>
                                                    {template.name}
                                                </h3>
                                                <p className={`text-xs mt-1 truncate ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                                                    Intent: {template.intent} • Mood:{" "}
                                                    {template.mood}
                                                </p>
                                            </div>
                                        </div>

                                        <p className={`text-xs line-clamp-3 ${isLight ? "text-slate-600" : "text-slate-300"}`}>
                                            {template.description ||
                                                template.body.split("\n").slice(0, 3).join(" ")}
                                        </p>

                                        <div className={`flex items-center justify-between pt-4 border-t mt-4 ${isLight ? "border-slate-100" : "border-white/10"
                                            }`}>
                                            <span className="text-[10px] text-slate-500 font-medium">
                                                Updated{" "}
                                                {new Date(
                                                    template.updatedAt,
                                                ).toLocaleDateString()}
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] text-slate-400 uppercase tracking-wide">
                                                    Edit
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        handleDelete(template)
                                                    }}
                                                    className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-red-400 transition-all"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {mounted && createPortal(
                <AnimatePresence>
                    {editing && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none p-4">
                            {/* Backdrop */}
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                key="backdrop"
                                onClick={() => !saving && setEditing(null)}
                                className={`absolute inset-0 pointer-events-auto backdrop-blur-sm ${isLight ? "bg-black/40" : "bg-black/60"
                                    }`}
                            />

                            {/* Modal */}
                            <motion.div
                                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                                animate={{ scale: 1, opacity: 1, y: 0 }}
                                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                                key="modal"
                                className={`relative flex w-full max-h-[90vh] max-w-3xl flex-col rounded-2xl border shadow-2xl pointer-events-auto ${isLight
                                    ? "bg-white text-slate-900 border-slate-200"
                                    : "bg-slate-900 text-slate-50 border-white/10"
                                    }`}
                            >
                                <div
                                    className={`flex items-center justify-between px-6 py-5 border-b ${isLight ? "border-slate-100" : "border-white/10"
                                        }`}
                                >
                                    <div>
                                        <h2 className="text-xl font-bold">
                                            {editing.id ? "Edit template" : "New template"}
                                        </h2>
                                        <p
                                            className={`mt-1 text-sm ${isLight ? "text-slate-500" : "text-slate-400"
                                                }`}
                                        >
                                            Use {"{{variable}}"} placeholders to personalize replies.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setEditing(null)}
                                        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${isLight
                                            ? "bg-slate-100 hover:bg-slate-200 text-slate-600"
                                            : "bg-white/10 hover:bg-white/15 text-slate-300"
                                            }`}
                                    >
                                        <Plus className="w-5 h-5 rotate-45" />
                                    </button>
                                </div>

                                <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-4">
                                            <div>
                                                <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${isLight ? "text-slate-500" : "text-slate-400"
                                                    }`}>
                                                    Template Name
                                                </label>
                                                <input
                                                    type="text"
                                                    value={editing.name}
                                                    onChange={(e) =>
                                                        setEditing((prev) =>
                                                            prev
                                                                ? { ...prev, name: e.target.value }
                                                                : prev,
                                                        )
                                                    }
                                                    placeholder="e.g. Shipping Update"
                                                    className={`w-full h-11 px-4 rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/30 ${isLight
                                                        ? "bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500"
                                                        : "bg-white/5 border border-white/10 text-white placeholder:text-slate-500 focus:border-indigo-500"
                                                        }`}
                                                />
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div>
                                                    <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${isLight ? "text-slate-500" : "text-slate-400"
                                                        }`}>
                                                        Intent
                                                    </label>
                                                    <select
                                                        value={editing.intent}
                                                        onChange={(e) =>
                                                            setEditing((prev) =>
                                                                prev
                                                                    ? {
                                                                        ...prev,
                                                                        intent: e.target.value,
                                                                    }
                                                                    : prev,
                                                            )
                                                        }
                                                        className={`w-full h-11 px-4 rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/30 ${isLight
                                                            ? "bg-slate-50 border border-slate-200 text-slate-900 focus:border-indigo-500"
                                                            : "bg-white/5 border border-white/10 text-white focus:border-indigo-500"
                                                            }`}
                                                    >
                                                        {INTENT_OPTIONS.map((opt) => (
                                                            <option key={opt.value} value={opt.value}>
                                                                {opt.label}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${isLight ? "text-slate-500" : "text-slate-400"
                                                        }`}>
                                                        Mood
                                                    </label>
                                                    <select
                                                        value={editing.mood}
                                                        onChange={(e) =>
                                                            setEditing((prev) =>
                                                                prev
                                                                    ? {
                                                                        ...prev,
                                                                        mood: e.target.value,
                                                                    }
                                                                    : prev,
                                                            )
                                                        }
                                                        className={`w-full h-11 px-4 rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/30 ${isLight
                                                            ? "bg-slate-50 border border-slate-200 text-slate-900 focus:border-indigo-500"
                                                            : "bg-white/5 border border-white/10 text-white focus:border-indigo-500"
                                                            }`}
                                                    >
                                                        {MOOD_OPTIONS.map((opt) => (
                                                            <option key={opt.value} value={opt.value}>
                                                                {opt.label}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>

                                            <div>
                                                <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${isLight ? "text-slate-500" : "text-slate-400"
                                                    }`}>
                                                    Description (optional)
                                                </label>
                                                <input
                                                    type="text"
                                                    value={editing.description || ""}
                                                    onChange={(e) =>
                                                        setEditing((prev) =>
                                                            prev
                                                                ? {
                                                                    ...prev,
                                                                    description: e.target.value,
                                                                }
                                                                : prev,
                                                        )
                                                    }
                                                    placeholder="Short summary for your team"
                                                    className={`w-full h-11 px-4 rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/30 ${isLight
                                                        ? "bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500"
                                                        : "bg-white/5 border border-white/10 text-white placeholder:text-slate-500 focus:border-indigo-500"
                                                        }`}
                                                />
                                            </div>
                                        </div>

                                        <div className={`p-4 rounded-2xl border ${isLight ? "bg-indigo-50/50 border-indigo-100" : "bg-indigo-500/5 border-indigo-500/10"
                                            }`}>
                                            <p className={`text-xs font-bold uppercase tracking-wider mb-3 ${isLight ? "text-indigo-600" : "text-indigo-400"
                                                }`}>
                                                Available variables
                                            </p>
                                            <div className="grid grid-cols-1 gap-2">
                                                {[
                                                    { key: "{{customer_name}}", label: "Customer's name" },
                                                    { key: "{{customer_email}}", label: "Customer's email" },
                                                    { key: "{{store_name}}", label: "Store name" },
                                                    { key: "{{ticket_summary}}", label: "Email summary" }
                                                ].map((v) => (
                                                    <div key={v.key} className="flex items-center justify-between text-[11px]">
                                                        <code className={`px-2 py-0.5 rounded font-mono font-bold ${isLight ? "bg-white border border-indigo-200 text-indigo-700" : "bg-white/10 text-indigo-300"
                                                            }`}>
                                                            {v.key}
                                                        </code>
                                                        <span className={isLight ? "text-slate-500" : "text-slate-400"}>{v.label}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <label className={`block text-xs font-bold uppercase tracking-wider ${isLight ? "text-slate-500" : "text-slate-400"
                                                }`}>
                                                Template body
                                            </label>
                                            <span className={`text-[10px] ${isLight ? "text-slate-400" : "text-slate-500"}`}>
                                                Markdown & HTML supported
                                            </span>
                                        </div>
                                        <textarea
                                            value={editing.body}
                                            onChange={(e) =>
                                                setEditing((prev) =>
                                                    prev ? { ...prev, body: e.target.value } : prev,
                                                )
                                            }
                                            rows={8}
                                            className={`w-full rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/30 p-4 font-mono text-xs leading-relaxed ${isLight
                                                ? "bg-slate-50 border border-slate-200 text-slate-900 focus:border-indigo-500"
                                                : "bg-white/5 border border-white/10 text-white focus:border-indigo-500"
                                                }`}
                                        />
                                    </div>

                                    <div className="space-y-4">
                                        <label className={`block text-xs font-bold uppercase tracking-wider ${isLight ? "text-slate-500" : "text-slate-400"
                                            }`}>
                                            Preview with example data
                                        </label>
                                        <div className={`rounded-xl border p-5 text-sm leading-relaxed whitespace-pre-wrap ${isLight
                                            ? "bg-slate-50 border-slate-200 text-slate-800"
                                            : "bg-slate-950 border-white/5 text-slate-300 shadow-inner"
                                            }`}>
                                            {currentPreview || "Preview will appear here..."}
                                        </div>
                                    </div>
                                </div>

                                <div className={`px-6 py-4 border-t flex items-center justify-between ${isLight ? "border-slate-100 bg-slate-50/50" : "border-white/10 bg-white/[0.02]"
                                    }`}>
                                    <p className={`text-[11px] font-medium ${isLight ? "text-slate-500" : "text-slate-500"}`}>
                                        Autosaved to your draft templates.
                                    </p>
                                    <div className="flex items-center gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setEditing(null)}
                                            className={`h-10 px-6 rounded-xl font-bold transition-all border ${isLight
                                                ? "bg-white text-slate-700 hover:bg-slate-50 border-slate-200"
                                                : "bg-white/10 text-slate-300 hover:bg-white/20 border-white/10"
                                                }`}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            disabled={saving}
                                            onClick={() => void handleSave()}
                                            className="h-10 px-6 bg-indigo-500 text-sm font-bold text-white hover:bg-indigo-600 border border-indigo-400/20 shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 rounded-xl"
                                        >
                                            {saving ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                    Saving...
                                                </>
                                            ) : (
                                                "Save template"
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </div>
    )
}

