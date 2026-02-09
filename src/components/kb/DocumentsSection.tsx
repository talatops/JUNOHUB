"use client"

import { useEffect, useState } from "react"

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
}

export function DocumentsSection({ storeId }: DocumentsSectionProps) {
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
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-white">
                        Documents
                    </h3>
                    <p className="text-xs text-slate-400">
                        Upload PDFs or DOCX files to power AI answers.
                    </p>
                </div>
                <label className="inline-flex items-center px-3 py-2 rounded-lg bg-indigo-600/80 hover:bg-indigo-600 text-sm font-medium text-white cursor-pointer transition-colors">
                    <span>{isUploading ? "Uploading..." : "Upload document"}</span>
                    <input
                        type="file"
                        accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        className="hidden"
                        onChange={handleUpload}
                        disabled={isUploading}
                    />
                </label>
            </div>

            {error && (
                <div className="text-xs text-red-400 bg-red-950/40 border border-red-900/50 rounded-md px-3 py-2">
                    {error}
                </div>
            )}

            <div className="border border-white/5 rounded-xl bg-slate-900/40 backdrop-blur-sm">
                <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-300 uppercase tracking-wide">
                        Uploaded documents
                    </span>
                    {isLoading && (
                        <span className="text-xs text-slate-400">Loading...</span>
                    )}
                </div>
                <div className="divide-y divide-white/5">
                    {documents.length === 0 && !isLoading ? (
                        <div className="px-4 py-6 text-sm text-slate-400 text-center">
                            No documents yet. Upload your first knowledge base file.
                        </div>
                    ) : (
                        documents.map((doc) => (
                            <div
                                key={doc.id}
                                className="px-4 py-3 flex items-center justify-between gap-4 text-sm"
                            >
                                <div>
                                    <p className="font-medium text-white">
                                        {doc.title}
                                    </p>
                                    <p className="text-xs text-slate-400">
                                        {doc.fileName} •{" "}
                                        {(doc.sizeBytes / 1024).toFixed(1)} KB
                                    </p>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-right">
                                    <span
                                        className={`inline-flex items-center px-2 py-1 rounded-full border ${
                                            doc.status === "READY"
                                                ? "border-emerald-500/60 text-emerald-400 bg-emerald-500/10"
                                                : doc.status === "PROCESSING"
                                                ? "border-amber-500/60 text-amber-400 bg-amber-500/10"
                                                : doc.status === "FAILED"
                                                ? "border-red-500/60 text-red-400 bg-red-500/10"
                                                : "border-slate-600 text-slate-300 bg-slate-800/60"
                                        }`}
                                    >
                                        {doc.status.toLowerCase()}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => void handleDelete(doc.id)}
                                        className="px-2 py-1 rounded-md border border-red-500/60 text-red-400 hover:bg-red-500/10 transition-colors"
                                    >
                                        Delete
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

