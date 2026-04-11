import OpenAI from "openai"
import { logger } from "@/lib/logger"
import {
    KB_EMBEDDING_DIMENSIONS,
    KB_EMBEDDING_MODEL,
} from "@/lib/kb/embeddingMeta"

const MAX_INPUTS_PER_REQUEST = 64
const MAX_RETRIES = 5
const BASE_DELAY_MS = 800

function sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms))
}

function isRetryableStatus(status: number | undefined) {
    return status === 429 || (status !== undefined && status >= 500)
}

/**
 * Batch embeddings via OpenAI (text-embedding-3-small + dimensions for pgvector / cost tradeoff).
 * Returns one vector per input; empty strings yield empty arrays (callers skip DB insert).
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return []

    const apiKey = process.env.OPENAI_API_KEY?.trim()
    if (!apiKey) {
        logger.error("OPENAI_API_KEY is not set; cannot generate embeddings")
        return texts.map(() => [])
    }

    const client = new OpenAI({ apiKey })
    const out: number[][] = new Array(texts.length).fill(null).map(() => [])

    for (let start = 0; start < texts.length; start += MAX_INPUTS_PER_REQUEST) {
        const end = Math.min(start + MAX_INPUTS_PER_REQUEST, texts.length)
        const slice = texts.slice(start, end)
        const normalized = slice.map((t) => (t.trim().length ? t.trim() : ""))

        const indicesWithText: number[] = []
        const inputs: string[] = []
        normalized.forEach((t, i) => {
            if (t.length) {
                indicesWithText.push(start + i)
                inputs.push(t)
            }
        })

        if (inputs.length === 0) continue

        let attempt = 0
        let embeddings: number[][] | null = null

        while (attempt <= MAX_RETRIES) {
            try {
                const started = Date.now()
                const res = await client.embeddings.create({
                    model: KB_EMBEDDING_MODEL,
                    input: inputs,
                    dimensions: KB_EMBEDDING_DIMENSIONS,
                })
                logger.info("OpenAI embeddings batch", {
                    count: inputs.length,
                    ms: Date.now() - started,
                    model: KB_EMBEDDING_MODEL,
                })

                const byIndex = new Map<number, number[]>()
                for (const item of res.data) {
                    const vec = item.embedding
                    if (!Array.isArray(vec) || vec.length !== KB_EMBEDDING_DIMENSIONS) {
                        logger.error("Unexpected embedding dimensions from OpenAI", {
                            expected: KB_EMBEDDING_DIMENSIONS,
                            got: vec?.length,
                        })
                        throw new Error("Invalid embedding dimensions")
                    }
                    byIndex.set(item.index, vec)
                }

                embeddings = []
                for (let i = 0; i < inputs.length; i++) {
                    const vec = byIndex.get(i)
                    embeddings.push(vec ?? [])
                }
                break
            } catch (err: unknown) {
                const status =
                    err && typeof err === "object" && "status" in err
                        ? Number((err as { status?: number }).status)
                        : undefined
                if (!isRetryableStatus(status) || attempt >= MAX_RETRIES) {
                    logger.error("OpenAI embedding request failed", {
                        attempt,
                        status,
                        message: err instanceof Error ? err.message : String(err),
                    })
                    embeddings = inputs.map(() => [])
                    break
                }
                const delay = BASE_DELAY_MS * Math.pow(2, attempt)
                logger.warn(`OpenAI embeddings retry in ${delay}ms`, { attempt, status })
                await sleep(delay)
                attempt++
            }
        }

        if (!embeddings) continue

        embeddings.forEach((vec, j) => {
            const globalIdx = indicesWithText[j]!
            out[globalIdx] = vec
        })
    }

    return out
}
