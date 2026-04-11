/** OpenAI embedding model used for pgvector rows (must match query-time filters). */
export const KB_EMBEDDING_MODEL =
    process.env.OPENAI_EMBEDDING_MODEL?.trim() || "text-embedding-3-small"

const parsedDims = Number(process.env.OPENAI_EMBEDDING_DIMENSIONS || "1024")
export const KB_EMBEDDING_DIMENSIONS =
    Number.isFinite(parsedDims) && parsedDims > 0 ? parsedDims : 1024

export const KB_EMBEDDING_PROVIDER = "openai" as const

export type KbChunkEmbeddingMetadata = {
    provider: typeof KB_EMBEDDING_PROVIDER
    embeddingModel: string
    embeddingDims: number
    sourceKey?: string
    /** L1 module code for RAG filtering (e.g. FAQ, ORDER_STATUS). */
    moduleCode?: string
    /** Shared field id (sf_*) or legacy key. */
    fieldId?: string
}

export function kbEmbeddingMetadata(
    extra?: Partial<
        Pick<KbChunkEmbeddingMetadata, "sourceKey" | "moduleCode" | "fieldId">
    >,
): KbChunkEmbeddingMetadata {
    return {
        provider: KB_EMBEDDING_PROVIDER,
        embeddingModel: KB_EMBEDDING_MODEL,
        embeddingDims: KB_EMBEDDING_DIMENSIONS,
        ...extra,
    }
}
