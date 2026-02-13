"use client"

import { useEffect, useMemo, useState } from "react"
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
    const { theme } = useTheme()
    const isLight = theme === "light"

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
            <div className="bg-white/5 backdrop-blur-xl rounded-xl md:rounded-2xl border border-white/10 overflow-hidden flex flex-col flex-1 min-h-0">
                <div className="p-4 md:p-6 border-b border-white/10 flex flex-col sm:flex-row gap-3 md:gap-4 justify-between bg-white/5 flex-shrink-0">
                    <div className="relative flex-1 min-w-0">
                        <Search className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Search templates by name, intent, or mood..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full h-10 md:h-11 pl-10 md:pl-11 pr-4 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 text-white placeholder:text-slate-500 text-sm font-medium transition-all"
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
                                        className="bg-white/5 backdrop-blur-xl p-4 md:p-6 rounded-xl md:rounded-2xl border border-white/10 hover:bg-white/[0.07] hover:border-indigo-500/30 transition-all group text-left"
                                    >
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-bold text-base md:text-lg text-white truncate group-hover:text-indigo-400 transition-colors">
                                                    {template.name}
                                                </h3>
                                                <p className="text-xs text-slate-400 mt-1 truncate">
                                                    Intent: {template.intent} • Mood:{" "}
                                                    {template.mood}
                                                </p>
                                            </div>
                                        </div>

                                        <p className="text-xs text-slate-300 line-clamp-3">
                                            {template.description ||
                                                template.body.split("\n").slice(0, 3).join(" ")}
                                        </p>

                                        <div className="flex items-center justify-between pt-4 border-t border-white/10 mt-4">
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

            {editing && (
                <div
                    className={`fixed inset-0 z-40 flex items-start justify-center px-4 pt-20 md:pt-24 ${
                        isLight ? "bg-slate-900/10" : "bg-slate-950/60"
                    }`}
                >
                    <div
                        className={`flex w-full max-h-[90vh] max-w-3xl flex-col rounded-2xl border shadow-2xl ${
                            isLight
                                ? "bg-white text-slate-900 border-slate-200"
                                : "bg-slate-950 text-slate-50 border-white/10"
                        }`}
                    >
                        <div
                            className={`flex items-center justify-between px-5 py-4 border-b ${
                                isLight ? "border-slate-200" : "border-white/10"
                            }`}
                        >
                            <div>
                                <h2 className="text-lg font-bold">
                                    {editing.id ? "Edit template" : "New template"}
                                </h2>
                                <p
                                    className={`mt-0.5 text-xs ${
                                        isLight ? "text-slate-500" : "text-slate-400"
                                    }`}
                                >
                                    Use {"{{variable}}"} placeholders to personalize replies.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setEditing(null)}
                                className={`text-sm ${
                                    isLight
                                        ? "text-slate-500 hover:text-slate-900"
                                        : "text-slate-400 hover:text-white"
                                }`}
                            >
                                Close
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                            Name
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
                                            className="w-full h-9 px-3 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
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
                                                className="w-full h-9 px-3 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                                            >
                                                {INTENT_OPTIONS.map((opt) => (
                                                    <option key={opt.value} value={opt.value}>
                                                        {opt.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
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
                                                className="w-full h-9 px-3 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
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
                                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
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
                                            className="w-full h-9 px-3 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                                            placeholder="Short summary for your team"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
                                    <p className="font-semibold text-slate-800 dark:text-slate-200">
                                        Available variables
                                    </p>
                                    <ul className="space-y-1">
                                        <li>
                                            <code className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-900/80 rounded border border-slate-200 dark:border-white/10 text-[11px]">
                                                {"{{customer_name}}"}
                                            </code>{" "}
                                            – Customer’s name
                                        </li>
                                        <li>
                                            <code className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-900/80 rounded border border-slate-200 dark:border-white/10 text-[11px]">
                                                {"{{customer_email}}"}
                                            </code>{" "}
                                            – Customer’s email
                                        </li>
                                        <li>
                                            <code className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-900/80 rounded border border-slate-200 dark:border-white/10 text-[11px]">
                                                {"{{store_name}}"}
                                            </code>{" "}
                                            – Store name
                                        </li>
                                        <li>
                                            <code className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-900/80 rounded border border-slate-200 dark:border-white/10 text-[11px]">
                                                {"{{ticket_summary}}"}
                                            </code>{" "}
                                            – Short summary of the customer’s email
                                        </li>
                                    </ul>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                    Template body
                                </label>
                                <textarea
                                    value={editing.body}
                                    onChange={(e) =>
                                        setEditing((prev) =>
                                            prev ? { ...prev, body: e.target.value } : prev,
                                        )
                                    }
                                    rows={8}
                                    className="w-full rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-slate-100 font-mono p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                                />
                            </div>

                            <div>
                                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                    Preview with example data
                                </p>
                                <div className="rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900/80 p-4 text-xs text-slate-900 dark:text-slate-100 whitespace-pre-wrap">
                                    {currentPreview || "Preview will appear here."}
                                </div>
                            </div>
                        </div>

                        <div className="px-5 py-3 border-t border-slate-200 dark:border-white/10 flex items-center justify-between">
                            <p className="text-[11px] text-slate-500 dark:text-slate-500">
                                Templates use simple {"{{variable}}"} placeholders only.
                            </p>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setEditing(null)}
                                    className="h-8 px-3 rounded-lg border border-slate-200 dark:border-white/10 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    disabled={saving}
                                    onClick={() => void handleSave()}
                                    className="h-8 px-3 rounded-lg bg-indigo-500 text-xs font-semibold text-white hover:bg-indigo-600 border border-indigo-400/30 disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    {saving ? "Saving..." : "Save template"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

