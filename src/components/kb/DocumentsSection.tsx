"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useTheme } from "@/components/ThemeProvider"
import { cn } from "@/lib/utils"

type KnowledgeDocument = {
    id: string
    title: string
    fileName: string
    mimeType: string
    sizeBytes: number
    status: string
    createdAt: string
    updatedAt: string
}

type DocumentsSectionProps = {
    storeId: string
    locked?: boolean
    lockedMessage?: string
    settingsHref?: string
}

export function DocumentsSection({
    storeId,
    locked = false,
    lockedMessage = "This store uses structured knowledge. Switch to Documents & FAQs above or edit your structured profile.",
    settingsHref = "/dashboard/juno-engine/knowledge-base#kb-source",
}: DocumentsSectionProps) {
    const { theme } = useTheme()
    const isLight = theme === "light"
    const [documents, setDocuments] = useState<KnowledgeDocument[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function refreshDocuments() {
        try {
            setIsLoading(true)
            setError(null)
            const res = await fetch(
                `/api/stores/${encodeURIComponent(storeId)}/kb/documents`,
            )
            if (!res.ok) {
                throw new Error("Failed to load documents")
            }
            const json = (await res.json()) as { documents: KnowledgeDocument[] }
            setDocuments(json.documents)
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Failed to load documents",
            )
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        if (!storeId) return
        void refreshDocuments()
    }, [storeId])

    async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file) return

        const formData = new FormData()
        formData.append("file", file)

        try {
            setIsUploading(true)
            setError(null)
            const res = await fetch(
                `/api/stores/${encodeURIComponent(storeId)}/kb/documents`,
                {
                    method: "POST",
                    body: formData,
                },
            )

            if (!res.ok) {
                const json = await res.json().catch(() => ({}))
                throw new Error(json.message || "Failed to upload document")
            }

            await refreshDocuments()
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Failed to upload document",
            )
        } finally {
            setIsUploading(false)
            e.target.value = ""
        }
    }

    async function handleDelete(id: string) {
        if (!window.confirm("Are you sure you want to delete this document?")) {
            return
        }

        try {
            setError(null)
            const res = await fetch(
                `/api/stores/${encodeURIComponent(
                    storeId,
                )}/kb/documents?id=${encodeURIComponent(id)}`,
                {
                    method: "DELETE",
                },
            )

            if (!res.ok) {
                const json = await res.json().catch(() => ({}))
                throw new Error(json.message || "Failed to delete document")
            }

            await refreshDocuments()
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Failed to delete document",
            )
        }
    }

    return (
        <div className="space-y-4">
            {locked && (
                <div
                    className={cn(
                        "rounded-xl border px-4 py-3 text-sm",
                        isLight
                            ? "border-amber-200 bg-amber-50 text-amber-900"
                            : "border-amber-500/30 bg-amber-500/10 text-amber-100",
                    )}
                >
                    <p>{lockedMessage}</p>
                    <Link
                        href={settingsHref}
                        className={cn(
                            "mt-2 inline-block text-xs font-bold underline",
                            isLight ? "text-indigo-600" : "text-indigo-300",
                        )}
                    >
                        Knowledge base
                    </Link>
                </div>
            )}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className={cn("text-lg font-semibold", isLight ? "text-slate-900" : "text-white")}>
                        Documents
                    </h3>
                    <p className={cn("text-xs", isLight ? "text-slate-500" : "text-slate-400")}>
                        Upload PDFs or DOCX files to power AI answers.
                    </p>
                </div>
                <label
                    className={cn(
                        "inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors shadow-sm",
                        locked
                            ? "bg-slate-500 cursor-not-allowed opacity-60"
                            : "bg-indigo-600 hover:bg-indigo-700 cursor-pointer",
                    )}
                >
                    <span>{isUploading ? "Uploading..." : "Upload document"}</span>
                    <input
                        type="file"
                        accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        className="hidden"
                        onChange={handleUpload}
                        disabled={isUploading || locked}
                    />
                </label>
            </div>

            {error && (
                <div className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                    {error}
                </div>
            )}

            <div className={cn(
                "border rounded-xl",
                isLight ? "border-slate-100 bg-white" : "border-white/5 bg-slate-900/40 backdrop-blur-sm"
            )}>
                <div className={cn(
                    "px-4 py-3 border-b flex items-center justify-between",
                    isLight ? "border-slate-100" : "border-white/5"
                )}>
                    <span className={cn(
                        "text-xs font-semibold uppercase tracking-wide",
                        isLight ? "text-slate-500" : "text-slate-300"
                    )}>
                        Uploaded documents
                    </span>
                    {isLoading && (
                        <span className="text-xs text-slate-400 animate-pulse">Loading...</span>
                    )}
                </div>
                <div className={cn(
                    "divide-y",
                    isLight ? "divide-slate-50" : "divide-white/5"
                )}>
                    {documents.length === 0 && !isLoading ? (
                        <div className="px-4 py-10 text-sm text-slate-400 text-center">
                            No documents yet. Upload your first knowledge base file.
                        </div>
                    ) : (
                        documents.map((doc) => (
                            <div
                                key={doc.id}
                                className="px-4 py-4 flex items-center justify-between gap-4 text-sm hover:bg-slate-50/50 transition-colors"
                            >
                                <div className="min-w-0 flex-1">
                                    <p className={cn("font-medium truncate", isLight ? "text-slate-900" : "text-white")}>
                                        {doc.title}
                                    </p>
                                    <p className="text-xs text-slate-400 mt-0.5">
                                        {doc.fileName} •{" "}
                                        {(doc.sizeBytes / 1024).toFixed(1)} KB
                                    </p>
                                </div>
                                <div className="flex items-center gap-4 text-xs">
                                    <span
                                        className={cn(
                                            "inline-flex items-center px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider",
                                            doc.status === "READY"
                                                ? "border-emerald-500/20 text-emerald-600 bg-emerald-50"
                                                : doc.status === "PROCESSING"
                                                    ? "border-amber-500/20 text-amber-600 bg-amber-50"
                                                    : doc.status === "FAILED"
                                                        ? "border-red-500/20 text-red-600 bg-red-50"
                                                        : "border-slate-200 text-slate-500 bg-slate-50"
                                        )}
                                    >
                                        {doc.status.toLowerCase()}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => void handleDelete(doc.id)}
                                        disabled={locked}
                                        className="p-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                                        title="Delete document"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    )
}

