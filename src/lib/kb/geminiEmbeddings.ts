import { logger } from "@/lib/logger"

const GEMINI_API_KEY = process.env.GEMINI_API_KEY
// Use v1 text-embedding-004 by default; env can override with either
// "text-embedding-004" or "models/text-embedding-004".
const GEMINI_EMBEDDING_MODEL =
    process.env.GEMINI_EMBEDDING_MODEL || "text-embedding-004"

if (!GEMINI_API_KEY) {
    logger.warn("GEMINI_API_KEY is not set. Knowledge base embeddings will fail.")
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
    if (!GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY is not configured")
    }

    if (texts.length === 0) return []

    // Gemini embeddings API expects individual requests; keep a simple
    // implementation for now and optimize with batching later if needed.
    const results: number[][] = []

    for (const text of texts) {
        const trimmed = text.trim()
        if (!trimmed) {
            results.push([])
            continue
        }

        try {
            // Normalise model path for the URL for Gemini v1:
            // - If env already includes "models/...", use as-is
            // - Otherwise, prefix with "models/"
            const modelPath = GEMINI_EMBEDDING_MODEL.startsWith("models/")
                ? GEMINI_EMBEDDING_MODEL
                : `models/${GEMINI_EMBEDDING_MODEL}`

            const response = await fetch(
                "https://generativelanguage.googleapis.com/v1/" +
                    modelPath +
                    ":embedContent",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-goog-api-key": GEMINI_API_KEY,
                    },
                    // Do not send the model name in the body; the model is
                    // already specified in the URL and some Gemini endpoints
                    // reject fully-qualified names in the payload.
                    body: JSON.stringify({
                        content: {
                            parts: [{ text: trimmed }],
                        },
                    }),
                },
            )

            if (!response.ok) {
                const errorText = await response.text().catch(() => "")
                logger.error("Gemini embedding API error", {
                    status: response.status,
                    body: errorText,
                })
                // Fall back to empty vector so the rest of the pipeline
                // can continue without failing the request.
                results.push([])
                continue
            }

            const json = (await response.json()) as {
                embedding?: { values?: number[] }
            }

            const vector = json.embedding?.values
            if (!vector || !Array.isArray(vector)) {
                logger.error("Invalid embedding response from Gemini", json)
                results.push([])
                continue
            }

            results.push(vector)
        } catch (error) {
            logger.error("Gemini embedding request failed", error)
            // On any error, push an empty vector and continue.
            results.push([])
        }
    }

    return results
}

