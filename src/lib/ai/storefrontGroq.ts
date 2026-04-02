import { logger } from "@/lib/logger"
import { groqChatCompletion, type GroqChatMessage } from "@/lib/ai/groqClient"
import { getBlendedStorefrontContext } from "@/lib/storefront-chat/retrieval"

type HistoryMessage = {
    senderType: "CUSTOMER" | "AI"
    content: string
}

/** Customer is asking whether the store carries / sells a product (not policy/shipping). */
function isAskingAboutProductAvailability(query: string) {
    return /\b(do you have|have any|have you got|carry|carrying|sell|selling|in stock|out of stock|stock|available|got any|do you sell|do you carry|looking for|can i (get|buy)|can you get)\b/i.test(
        query.trim()
    )
}

const NO_EVIDENCE_PRODUCT_REPLY =
    "I do not see that item in this store’s catalog or FAQs I have access to, so I can’t confirm we carry it. If you have another product name or category from this shop, I can check again."

export async function generateStorefrontReply(params: {
    storeId: string
    query: string
    visitorId: string
    history: HistoryMessage[]
}) {
    const startedAt = Date.now()
    const { storeId, query, visitorId, history } = params

    const retrieval = await getBlendedStorefrontContext({ storeId, query })

    // Hard guard: do not invent inventory. If they ask “do you have X?” and we have no product row and no KB/FAQ hit, answer without the LLM.
    if (
        isAskingAboutProductAvailability(query) &&
        retrieval.productCount === 0 &&
        retrieval.kbCount === 0
    ) {
        logger.info("[STOREFRONT_AI_REPLY]", {
            storeId,
            visitorId,
            queryLength: query.length,
            kbHits: retrieval.kbCount,
            productHits: retrieval.productCount,
            latencyMs: Date.now() - startedAt,
            fallbackUsed: true,
            groundedSkipLlm: true,
            error: null,
        })
        return {
            content: NO_EVIDENCE_PRODUCT_REPLY,
            meta: {
                kbHits: retrieval.kbCount,
                productHits: retrieval.productCount,
                fallbackUsed: true,
            },
        }
    }

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
        "You are the JUNO storefront assistant. You ONLY answer using the Context block below (products, FAQs, knowledge chunks).",
        "If the Context does not clearly support an answer, say you cannot find it in the catalog or docs you have—do NOT guess.",
        "Never claim a product exists, is in stock, or that the store carries a category unless a Context line explicitly supports it.",
        "Never invent website layout: no tabs, menus, dropdowns, or navigation paths unless they appear verbatim in Context.",
        "Never invent URLs or deep links unless they appear in Context.",
        "Do not affirm availability with “yes” unless a PRODUCT line or FAQ/KB line in Context clearly covers what the customer asked.",
        "Be concise and friendly. Plain text only.",
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
        temperature: 0.1,
        maxTokens: 420,
        timeoutMs: 28_000,
    })

    const fallback =
        "I don’t have enough in the store’s catalog or FAQ context to answer that accurately. What product name or topic from this shop should I look for?"

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

