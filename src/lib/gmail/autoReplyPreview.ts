import { prisma } from "@/lib/prisma"
import { storeSelectGmailL1Context } from "@/lib/prisma/storeSelects"
import { logger } from "@/lib/logger"
import { classifyCustomerEmail, type ClassifyCustomerEmailResult } from "@/lib/ai/gmailGroq"
import { screenInboundEmailForAbuse } from "@/lib/ai/gmailSafety"
import {
    buildOrderSummaryForEmail,
    extractOrderNumberHints,
    stripQuotedEmailTrailForHints,
} from "@/lib/ai/gmailContext"
import { looksLikeOffTopic, looksLikeSensitiveOrderTopic } from "@/lib/ai/gmailOrderDisclosure"
import { parseEnvFloat } from "@/lib/gmail/gmailAutoReplyGuards"
import type { GmailClassification } from "@/lib/ai/gmailTaxonomy"
import { runL1Orchestrator } from "@/lib/ai/orchestrator/runL1"
import {
    buildHintUnmatchedFallbackHtml,
    buildL1HtmlEmail,
    buildMinimalFallbackHtml,
    buildNeedOrderIdFallbackHtml,
    buildOffTopicFallbackHtml,
    parseGmailReplyThemeJson,
    wrapGmailHtmlDocument,
} from "@/lib/gmail/emailReplyTheme"

export {
    buildHintUnmatchedFallbackHtml,
    buildL1HtmlEmail,
    buildMinimalFallbackHtml,
    buildNeedOrderIdFallbackHtml,
    buildOffTopicFallbackHtml,
} from "@/lib/gmail/emailReplyTheme"

export type AutoReplyPreviewInput = {
    storeId: string
    fromEmail: string
    subject: string
    body: string
}

export type AutoReplyPreviewOutput = {
    classification: GmailClassification
    classifySource: ClassifyCustomerEmailResult["source"]
    orderHints: string[]
    offTopicByHeuristic: boolean
    suppressOrdersOnFallbackClassification: boolean
    needsOrderNumberFirst: boolean
    hintUnmatched: boolean
    lowConfidenceSuppressOrders: boolean
    messageTooSparse: boolean
    skipOrderCacheForQuestion: boolean
    shouldLoadOrderCache: boolean
    sensitiveTopic: boolean
    orderSummaryRaw: string
    orderSummaryForContext: string
    ticketSummary: string
    usedFallback: "none" | "off_topic" | "need_order_id" | "hint_unmatched" | "minimal"
    html: string
    flagged: boolean
    flaggedReason?: string
    /** True when reply body came from the L1 orchestrator. */
    l1Used?: boolean
}

export async function generateAutoReplyPreview(
    input: AutoReplyPreviewInput,
): Promise<AutoReplyPreviewOutput> {
    const senderEmail = input.fromEmail.trim().toLowerCase()
    const emailSubject = input.subject || "No Subject"
    const emailBody = input.body || ""

    const plainForAi = emailBody.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()

    const safety = await screenInboundEmailForAbuse(emailSubject, plainForAi)
    if (safety?.flagged) {
        const store = await prisma.store.findUnique({
            where: { id: input.storeId },
            select: { businessName: true, email: true, gmailReplyTheme: true },
        })
        const storeName = store?.businessName || "Your store"
        const replyTheme = parseGmailReplyThemeJson(store?.gmailReplyTheme)
        return {
            classification: { intent: "general", mood: "neutral", confidence: 0.0, short_summary: "" },
            classifySource: "fallback",
            orderHints: [],
            offTopicByHeuristic: false,
            suppressOrdersOnFallbackClassification: false,
            needsOrderNumberFirst: false,
            hintUnmatched: false,
            lowConfidenceSuppressOrders: false,
            messageTooSparse: false,
            skipOrderCacheForQuestion: false,
            shouldLoadOrderCache: false,
            sensitiveTopic: false,
            orderSummaryRaw: "",
            orderSummaryForContext: "",
            ticketSummary: "",
            usedFallback: "minimal",
            html: wrapGmailHtmlDocument(
                buildMinimalFallbackHtml(emailBody, storeName, replyTheme),
                replyTheme,
            ),
            flagged: true,
            flaggedReason: safety.reason,
            l1Used: false,
        }
    }

    const classifyResult = await classifyCustomerEmail(emailSubject, plainForAi)
    const classification = classifyResult.classification

    const hintSourceFull = `${emailSubject}\n${plainForAi}`
    const hintSourceForHints = stripQuotedEmailTrailForHints(hintSourceFull)

    const extractedHints = extractOrderNumberHints(hintSourceForHints)
    const offTopicByHeuristic = looksLikeOffTopic(hintSourceFull) && extractedHints.length === 0
    const isOffTopic = classification.intent === "off_topic" || offTopicByHeuristic
    const orderHints = isOffTopic ? [] : extractedHints

    const intentsNeedingOrderIdWhenAmbiguous = new Set([
        "shipping_delay",
        "refund_request",
        "account_billing",
    ])
    const sensitiveTopic = !isOffTopic && looksLikeSensitiveOrderTopic(hintSourceFull)
    const needsOrderNumberFirst =
        !isOffTopic &&
        orderHints.length === 0 &&
        (intentsNeedingOrderIdWhenAmbiguous.has(classification.intent) || sensitiveTopic)

    const confidenceMin = parseEnvFloat("GMAIL_CLASSIFY_CONFIDENCE_MIN", 0.5)
    const lowConfidenceSuppressOrders =
        classifyResult.source !== "fallback" &&
        classification.confidence < confidenceMin &&
        orderHints.length === 0 &&
        !isOffTopic &&
        (classification.intent === "general" || classification.intent === "question")

    const messageTooSparse = plainForAi.trim().length < 12 && orderHints.length === 0

    const skipOrderCacheForQuestion =
        classification.intent === "question" && orderHints.length === 0 && !isOffTopic

    // Default-safe: if Groq classification failed, do not attach CachedOrder unless the customer provided an order number hint.
    const suppressOrdersOnFallbackClassification =
        classifyResult.source === "fallback" && extractedHints.length === 0 && !isOffTopic

    const shouldLoadOrderCache =
        !isOffTopic &&
        !needsOrderNumberFirst &&
        !lowConfidenceSuppressOrders &&
        !messageTooSparse &&
        !skipOrderCacheForQuestion &&
        !suppressOrdersOnFallbackClassification

    let orderSummaryRaw = ""
    let hintUnmatched = false
    if (shouldLoadOrderCache) {
        const built = await buildOrderSummaryForEmail(input.storeId, senderEmail, hintSourceForHints)
        orderSummaryRaw = built.summary
        hintUnmatched = built.hintUnmatched
    }

    logger.info("Gmail auto-reply preview", {
        storeId: input.storeId,
        senderEmail,
        intent: classification.intent,
        mood: classification.mood,
        confidence: classification.confidence,
        classifySource: classifyResult.source,
        orderHints,
        offTopicByHeuristic,
        needsOrderNumberFirst,
        hintUnmatched,
        lowConfidenceSuppressOrders,
        messageTooSparse,
        suppressOrdersOnFallbackClassification,
    })

    const store = await prisma.store.findUnique({
        where: { id: input.storeId },
        select: storeSelectGmailL1Context,
    })

    const storeName = store?.businessName || "Your store"
    const replyTheme = parseGmailReplyThemeJson(store?.gmailReplyTheme)

    const ticketSummary = messageTooSparse
        ? "We could not read enough text in your message to look up an order automatically. Please reply with a short description and your order number if you have one."
        : classification.short_summary?.trim() || plainForAi.slice(0, 500) || emailBody.slice(0, 500)

    const offTopicOrderLine = `We don't include order or purchase history for unrelated topics. For help with ${storeName}, reply with a store-related question and your order number if you have one.`

    const counterOrderIdLine = `No order details are shown yet — we did not see an order number in your message. Please reply with your order number (e.g. #1002 or 1002) from your ${storeName} confirmation email so we can look up the correct order.`

    const hintUnmatchedOrderLine = `We could not match the order number(s) in your message to an order on file for ${storeName} under this email. Please double-check the number or confirm the email address used at checkout.`

    const lowConfidenceOrderLine = `We were not fully confident how to categorize your message. If this is about an order, reply with your order number from your ${storeName} confirmation email so we can pull up the right record.`

    const sparseBodyOrderLine = `We could not read enough detail in your message to look anything up automatically. Please reply with a sentence or two and your order number if your question is about a ${storeName} order.`

    const questionNoOrderLine = `We are replying without attaching order history. If your question relates to a specific purchase, reply with your order number (e.g. #1002).`

    const noOrdersFallback = sensitiveTopic
        ? `No matching recent orders on file for ${storeName} under this email. If you used a different email at checkout, reply from that address or send your order number.`
        : "No matching recent orders on file for this email."

    let orderSummaryForContext: string
    if (isOffTopic) {
        orderSummaryForContext = offTopicOrderLine
    } else if (needsOrderNumberFirst) {
        orderSummaryForContext = counterOrderIdLine
    } else if (hintUnmatched) {
        orderSummaryForContext = hintUnmatchedOrderLine
    } else if (lowConfidenceSuppressOrders) {
        orderSummaryForContext = lowConfidenceOrderLine
    } else if (messageTooSparse) {
        orderSummaryForContext = sparseBodyOrderLine
    } else if (skipOrderCacheForQuestion) {
        orderSummaryForContext = questionNoOrderLine
    } else {
        orderSummaryForContext = orderSummaryRaw || noOrdersFallback
    }

    const skipL1Orchestrator =
        isOffTopic ||
        messageTooSparse ||
        needsOrderNumberFirst ||
        hintUnmatched

    let html: string | null = null
    let l1Used = false

    if (!skipL1Orchestrator) {
        try {
            const l1 = await runL1Orchestrator({
                channel: "email",
                storeId: input.storeId,
                storeName,
                message: plainForAi,
                history: [],
                aiModulesJson: store?.aiModules ?? null,
                sharedFieldAnswersJson: store?.sharedFieldAnswers ?? null,
                categoryMetadetailsEnabled: store?.categoryMetadetailsEnabled,
                emailFrom: senderEmail,
            })
            if (l1.text.trim().length > 0) {
                html = buildL1HtmlEmail(l1.text.trim(), storeName, replyTheme)
                l1Used = true
            }
        } catch (e) {
            logger.error("generateAutoReplyPreview: L1 orchestrator failed", e)
        }
    }

    let usedFallback: AutoReplyPreviewOutput["usedFallback"] = "none"
    if (!html) {
        if (isOffTopic) {
            usedFallback = "off_topic"
            html = buildOffTopicFallbackHtml(storeName, store?.email || "", replyTheme)
        } else if (needsOrderNumberFirst) {
            usedFallback = "need_order_id"
            html = buildNeedOrderIdFallbackHtml(storeName, store?.email || "", replyTheme)
        } else if (hintUnmatched) {
            usedFallback = "hint_unmatched"
            html = buildHintUnmatchedFallbackHtml(storeName, store?.email || "", replyTheme)
        } else {
            usedFallback = "minimal"
            html = buildMinimalFallbackHtml(emailBody, storeName, replyTheme)
        }
    }

    return {
        classification,
        classifySource: classifyResult.source,
        orderHints,
        offTopicByHeuristic,
        suppressOrdersOnFallbackClassification,
        needsOrderNumberFirst,
        hintUnmatched,
        lowConfidenceSuppressOrders,
        messageTooSparse,
        skipOrderCacheForQuestion,
        shouldLoadOrderCache,
        sensitiveTopic,
        orderSummaryRaw,
        orderSummaryForContext,
        ticketSummary,
        usedFallback,
        html: wrapGmailHtmlDocument(html, replyTheme),
        flagged: false,
        l1Used,
    }
}
