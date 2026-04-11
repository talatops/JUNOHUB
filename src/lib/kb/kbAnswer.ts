import { openaiChatCompletion } from "@/lib/kb/openaiChat"
import { groqChatCompletion } from "@/lib/ai/groqClient"
import { logger } from "@/lib/logger"

/**
 * Generate an answer for KB RAG: OpenAI chat first, then Groq if OpenAI is unavailable or empty.
 */
export async function generateKbRagAnswer(
    userMessage: string,
    options: { systemPrompt: string; maxTokens?: number },
): Promise<{ text: string; source: "openai" | "groq" | "none" }> {
    const maxTokens = options.maxTokens ?? 512

    const openai = await openaiChatCompletion(
        [
            { role: "system", content: options.systemPrompt },
            { role: "user", content: userMessage },
        ],
        { maxTokens, temperature: 0.3 },
    )

    if (openai.content?.trim()) {
        return { text: openai.content, source: "openai" }
    }

    logger.info("KB answer falling back to Groq", { openaiError: openai.error })

    const groq = await groqChatCompletion(
        [
            { role: "system", content: options.systemPrompt },
            { role: "user", content: userMessage },
        ],
        { maxTokens, temperature: 0.2 },
    )

    if (groq.content?.trim()) {
        logger.info("KB answer generated via Groq fallback")
        return { text: groq.content, source: "groq" }
    }

    logger.error("KB answer: both OpenAI and Groq failed", {
        openaiError: openai.error,
        groqError: groq.error,
    })
    return {
        text: "I could not generate an answer right now. Please try again later.",
        source: "none",
    }
}
