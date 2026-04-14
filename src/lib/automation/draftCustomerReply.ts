import { aiChatCompletion } from "@/lib/ai/chatCompletion"
import { logger } from "@/lib/logger"

export async function draftCustomerReply(params: {
    storeName: string
    customerEmail: string
    ticketSubject: string
    conversation: string
}): Promise<{ subject: string; body: string } | null> {
    const system = [
        "You write concise, empathetic customer support emails for ecommerce vendors.",
        "Return JSON only: {\"subject\":\"...\",\"body\":\"...\"}.",
        "Body must be plain text (no markdown), 3-10 sentences.",
        "Do not invent policies or facts not present in the conversation.",
        "If details are missing, acknowledge and ask one short clarifying question.",
    ].join(" ")

    const user = [
        `Store: ${params.storeName}`,
        `Customer: ${params.customerEmail}`,
        `Ticket subject: ${params.ticketSubject}`,
        "",
        "Conversation transcript:",
        params.conversation.slice(0, 8000),
        "",
        "Draft a customer-ready email reply now.",
    ].join("\n")

    const { content, error } = await aiChatCompletion(
        [
            { role: "system", content: system },
            { role: "user", content: user },
        ],
        { jsonObject: true, temperature: 0.25, maxTokens: 450 },
    )

    if (!content) {
        logger.warn("draftCustomerReply: model call failed", { error })
        return null
    }

    try {
        const parsed = JSON.parse(content) as { subject?: unknown; body?: unknown }
        const subject =
            (typeof parsed.subject === "string" ? parsed.subject : "").trim().slice(0, 300) ||
            `Re: ${params.ticketSubject}`.slice(0, 300)
        const body = (typeof parsed.body === "string" ? parsed.body : "")
            .replace(/\0/g, "")
            .trim()
            .slice(0, 12000)
        if (!body) return null
        return { subject, body }
    } catch {
        logger.warn("draftCustomerReply: invalid JSON response")
        return null
    }
}
