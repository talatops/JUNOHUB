import { logger } from "@/lib/logger"

const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions"

/** Default fast model; override with GROQ_MODEL in env. */
export const DEFAULT_GROQ_MODEL = "llama-3.1-8b-instant"

const DEFAULT_TIMEOUT_MS = 45_000

export type GroqChatMessage = {
    role: "system" | "user" | "assistant"
    content: string
}

export type GroqChatOptions = {
    model?: string
    temperature?: number
    maxTokens?: number
    /** When set, requests JSON object responses (model-dependent). */
    jsonObject?: boolean
    timeoutMs?: number
}

/**
 * Call Groq OpenAI-compatible chat completions. Returns assistant text or null on failure.
 * Does not log message contents (only lengths / error status).
 */
export async function groqChatCompletion(
    messages: GroqChatMessage[],
    options: GroqChatOptions = {}
): Promise<{ content: string | null; error?: string }> {
    const apiKey = process.env.GROQ_API_KEY?.trim()
    if (!apiKey) {
        logger.warn("GROQ_API_KEY is not set; skipping Groq call")
        return { content: null, error: "missing_api_key" }
    }

    const model = options.model ?? process.env.GROQ_MODEL?.trim() ?? DEFAULT_GROQ_MODEL
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS

    const body: Record<string, unknown> = {
        model,
        messages,
        temperature: options.temperature ?? 0.2,
        max_tokens: options.maxTokens ?? 2048,
    }

    if (options.jsonObject) {
        body.response_format = { type: "json_object" }
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    try {
        const res = await fetch(GROQ_CHAT_URL, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
            signal: controller.signal,
        })

        if (!res.ok) {
            const errText = await res.text().catch(() => "")
            logger.warn("Groq API error", {
                status: res.status,
                bodyLength: errText.length,
            })
            return { content: null, error: `http_${res.status}` }
        }

        const data = (await res.json()) as {
            choices?: Array<{ message?: { content?: string } }>
        }
        const content = data.choices?.[0]?.message?.content?.trim() ?? null
        if (!content) {
            logger.warn("Groq returned empty content")
            return { content: null, error: "empty_content" }
        }

        return { content }
    } catch (e) {
        const aborted = e instanceof Error && e.name === "AbortError"
        logger.warn("Groq request failed", {
            aborted,
            message: e instanceof Error ? e.message : "unknown",
        })
        return { content: null, error: aborted ? "timeout" : "fetch_error" }
    } finally {
        clearTimeout(timer)
    }
}
