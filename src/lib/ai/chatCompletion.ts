import { logger } from "@/lib/logger"
import { groqChatCompletion } from "@/lib/ai/groqClient"
import { openaiChatCompletion } from "@/lib/kb/openaiChat"

export type AiChatMessage = {
    role: "system" | "user" | "assistant"
    content: string
}

export type AiChatOptions = {
    temperature?: number
    maxTokens?: number
    jsonObject?: boolean
    timeoutMs?: number
}

type Provider = "groq" | "openai"

function resolveProvider(): Provider {
    const raw = process.env.AI_CHAT_PROVIDER?.trim().toLowerCase()
    return raw === "openai" ? "openai" : "groq"
}

export function activeAiProvider(): Provider {
    return resolveProvider()
}

export async function aiChatCompletion(
    messages: AiChatMessage[],
    options: AiChatOptions = {},
): Promise<{ content: string | null; error?: string }> {
    const primary = resolveProvider()

    const run = async (provider: Provider) => {
        if (provider === "openai") {
            return openaiChatCompletion(messages, {
                temperature: options.temperature,
                maxTokens: options.maxTokens,
                jsonObject: options.jsonObject,
            })
        }
        return groqChatCompletion(messages, {
            temperature: options.temperature,
            maxTokens: options.maxTokens,
            jsonObject: options.jsonObject,
            timeoutMs: options.timeoutMs,
        })
    }

    const result = await run(primary)
    if (result.content) return result

    logger.warn("aiChatCompletion: provider call failed", {
        provider: primary,
        error: result.error ?? "unknown",
    })
    return {
        content: null,
        error: result.error || "provider_failure",
    }
}
