import { logger } from "@/lib/logger"
import { groqChatCompletion, type GroqChatMessage } from "@/lib/ai/groqClient"
import { getBlendedStorefrontContext } from "@/lib/storefront-chat/retrieval"

type HistoryMessage = {
    senderType: "CUSTOMER" | "AI"
    content: string
}

export async function generateStorefrontReply(params: {
    storeId: string
    query: string
    visitorId: string
    history: HistoryMessage[]
}) {
    const startedAt = Date.now()
    const { storeId, query, visitorId, history } = params

    const retrieval = await getBlendedStorefrontContext({ storeId, query })
    const contextLines = retrieval.items.map(
        (item, idx) => `[${idx + 1}] (${item.source}) ${item.title}: ${item.content}`
    )
    const contextBlock = contextLines.length
        ? contextLines.join("\n")
        : "No relevant KB/FAQ/product context found."

    const shortHistory = history.slice(-8).map((m) => ({
        role: m.senderType === "AI" ? "assistant" : "user",
        content: m.content,
    })) as GroqChatMessage[]

    const system = [
        "You are JUNO storefront assistant for an ecommerce store.",
        "Use the provided context first (products, FAQs, knowledge).",
        "If context is insufficient, ask one concise clarifying question.",
        "Do not invent exact prices, stock or policy details that are not present.",
        "Keep responses concise, friendly, and sales-supportive.",
        "Return plain text only.",
    ].join(" ")

    const user = [
        "Context:",
        contextBlock,
        "",
        `Visitor ID: ${visitorId}`,
        `Customer question: ${query}`,
    ].join("\n")

    const messages: GroqChatMessage[] = [
        { role: "system", content: system },
        ...shortHistory,
        { role: "user", content: user },
    ]

    const out = await groqChatCompletion(messages, {
        temperature: 0.2,
        maxTokens: 420,
        timeoutMs: 28_000,
    })

    const fallback =
        "Thanks for your message. I do not have enough details right now. Could you share the product name or what exactly you want to know?"

    const content = (out.content || "").trim() || fallback

    logger.info("[STOREFRONT_AI_REPLY]", {
        storeId,
        visitorId,
        queryLength: query.length,
        kbHits: retrieval.kbCount,
        productHits: retrieval.productCount,
        latencyMs: Date.now() - startedAt,
        fallbackUsed: !out.content,
        error: out.error || null,
    })

    return {
        content,
        meta: {
            kbHits: retrieval.kbCount,
            productHits: retrieval.productCount,
            fallbackUsed: !out.content,
        },
    }
}

