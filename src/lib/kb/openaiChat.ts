import OpenAI from "openai"
import { logger } from "@/lib/logger"

const DEFAULT_MODEL = "gpt-4o-mini"

export type OpenAiChatMessage = {
    role: "system" | "user" | "assistant"
    content: string
}

export type OpenAiChatOptions = {
    model?: string
    maxTokens?: number
    temperature?: number
    /** Request strict JSON object output when supported. */
    jsonObject?: boolean
}

/**
 * Chat completions via OpenAI (used for KB RAG answers; embeddings stay in openaiEmbeddings.ts).
 */
export async function openaiChatCompletion(
    messages: OpenAiChatMessage[],
    options: OpenAiChatOptions = {},
): Promise<{ content: string | null; error?: string }> {
    const apiKey = process.env.OPENAI_API_KEY?.trim()
    if (!apiKey) {
        logger.warn("OPENAI_API_KEY is not set; skipping OpenAI chat")
        return { content: null, error: "missing_api_key" }
    }

    const model =
        options.model?.trim() ||
        process.env.OPENAI_CHAT_MODEL?.trim() ||
        DEFAULT_MODEL

    try {
        const client = new OpenAI({ apiKey })
        const res = await client.chat.completions.create({
            model,
            messages,
            max_tokens: options.maxTokens ?? 512,
            temperature: options.temperature ?? 0.3,
            ...(options.jsonObject ? { response_format: { type: "json_object" as const } } : {}),
        })
        const text = res.choices[0]?.message?.content?.trim() ?? null
        if (!text) {
            return { content: null, error: "empty_response" }
        }
        return { content: text }
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        logger.warn("OpenAI chat completion failed", { message })
        return { content: null, error: message }
    }
}
