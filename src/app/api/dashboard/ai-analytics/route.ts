import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { getVendorActiveStore } from "@/lib/dashboard/vendorActiveStore"
import { classifyStorefrontCustomerQuery } from "@/lib/dashboard/storefrontQueryClassification"
import { bucketKey, emptyTimeline, getAnalyticsWindow, type AnalyticsGrain } from "@/lib/dashboard/analyticsTimeline"
import { computeAiRevenueAttribution } from "@/lib/analytics/revenueAttribution"
import { classifyAiResolution, classifyCustomerSentiment } from "@/lib/analytics/aiEvents"
import { parseStorefrontChatActions } from "@/lib/storefront-chat/actions"

type StorefrontMessageRow = {
    id: string
    senderType: "CUSTOMER" | "AI"
    createdAt: Date
    content: string
    conversationId: string
    actions: unknown
}

type AnalyticsEventRow = {
    id: string
    conversationId: string | null
    messageId: string | null
    eventType: string
    source: string
    productId: string | null
    variantId: string | null
    quantity: number | null
    amount: number | null
    currency: string | null
    sentiment: string | null
    resolutionStatus: string | null
    orderId: string | null
    attributionType: string | null
    metadata: unknown
    createdAt: Date
}

type ConversationRow = {
    id: string
    visitorId: string
    customerEmail: string | null
    boundShopifyOrderId: string | null
    createdAt: Date
    updatedAt: Date
}

type CachedOrderRow = {
    shopifyOrderId: string
    orderNumber: string
    email: string | null
    totalPrice: string
    currency: string | null
    lineItems: unknown
    noteAttributes?: unknown
    shopifyCreatedAt: Date | null
    createdAt: Date
}

type ChatMessageRow = {
    senderId: string
    receiverId: string
    createdAt: Date
}

type TicketLogRow = {
    id: string
    subject: string
    bodyPreview: string | null
    sentAt: Date
}

type PrismaWithAnalytics = typeof prisma & {
    aiAnalyticsEvent: {
        findMany: (args: {
            where: {
                storeId: string
                createdAt: { gte: Date; lte: Date }
            }
            select: Record<string, boolean>
            orderBy: { createdAt: "asc" }
        }) => Promise<AnalyticsEventRow[]>
    }
}

function analyticsEventKey(event: Pick<AnalyticsEventRow, "eventType" | "messageId" | "productId" | "variantId">) {
    return [event.eventType, event.messageId ?? "", event.productId ?? "", event.variantId ?? ""].join("|")
}

function syntheticEvent(params: {
    id: string
    conversationId?: string | null
    messageId?: string | null
    eventType: string
    productId?: string | null
    variantId?: string | null
    quantity?: number | null
    amount?: number | null
    sentiment?: string | null
    resolutionStatus?: string | null
    metadata?: unknown
    createdAt: Date
}): AnalyticsEventRow {
    return {
        id: params.id,
        conversationId: params.conversationId ?? null,
        messageId: params.messageId ?? null,
        eventType: params.eventType,
        source: "derived_from_existing_data",
        productId: params.productId ?? null,
        variantId: params.variantId ?? null,
        quantity: params.quantity ?? null,
        amount: params.amount ?? null,
        currency: null,
        sentiment: params.sentiment ?? null,
        resolutionStatus: params.resolutionStatus ?? null,
        orderId: null,
        attributionType: null,
        metadata: params.metadata ?? null,
        createdAt: params.createdAt,
    }
}

function deriveAnalyticsEventsFromExistingData(params: {
    persistedEvents: AnalyticsEventRow[]
    messages: StorefrontMessageRow[]
    ticketLogs: TicketLogRow[]
}): AnalyticsEventRow[] {
    const existingKeys = new Set(params.persistedEvents.map(analyticsEventKey))
    const derived: AnalyticsEventRow[] = []

    const pushIfMissing = (event: AnalyticsEventRow) => {
        const key = analyticsEventKey(event)
        if (existingKeys.has(key)) return
        existingKeys.add(key)
        derived.push(event)
    }

    for (const message of params.messages) {
        if (message.senderType === "CUSTOMER") {
            pushIfMissing(
                syntheticEvent({
                    id: `derived-question-${message.id}`,
                    conversationId: message.conversationId,
                    messageId: message.id,
                    eventType: "customer_question",
                    sentiment: classifyCustomerSentiment(message.content),
                    metadata: { derivedFrom: "StorefrontChatMessage" },
                    createdAt: message.createdAt,
                }),
            )
            continue
        }

        const resolutionStatus = classifyAiResolution({ content: message.content })
        pushIfMissing(
            syntheticEvent({
                id: `derived-ai-${message.id}`,
                conversationId: message.conversationId,
                messageId: message.id,
                eventType: "ai_answered",
                resolutionStatus,
                metadata: { derivedFrom: "StorefrontChatMessage" },
                createdAt: message.createdAt,
            }),
        )
        if (resolutionStatus === "resolved_by_ai") {
            pushIfMissing(
                syntheticEvent({
                    id: `derived-resolved-${message.id}`,
                    conversationId: message.conversationId,
                    messageId: message.id,
                    eventType: "resolved_by_ai",
                    resolutionStatus,
                    metadata: { derivedFrom: "StorefrontChatMessage" },
                    createdAt: message.createdAt,
                }),
            )
        } else if (resolutionStatus === "needs_follow_up") {
            pushIfMissing(
                syntheticEvent({
                    id: `derived-unresolved-${message.id}`,
                    conversationId: message.conversationId,
                    messageId: message.id,
                    eventType: "unresolved_question",
                    resolutionStatus,
                    metadata: { derivedFrom: "StorefrontChatMessage" },
                    createdAt: message.createdAt,
                }),
            )
        }

        for (const action of parseStorefrontChatActions(message.actions)) {
            if (action.type === "upsell_suggestion") {
                pushIfMissing(
                    syntheticEvent({
                        id: `derived-upsell-shown-${message.id}-${action.product.productId}`,
                        conversationId: message.conversationId,
                        messageId: message.id,
                        eventType: "upsell_shown",
                        productId: action.product.productId,
                        variantId: action.product.variantId ?? null,
                        quantity: action.product.quantity ?? 1,
                        amount: action.product.price ? Number(action.product.price) || null : null,
                        metadata: { derivedFrom: "StorefrontChatMessage.actions", title: action.product.title },
                        createdAt: message.createdAt,
                    }),
                )
            } else if (action.type === "add_to_cart") {
                pushIfMissing(
                    syntheticEvent({
                        id: `derived-cart-action-shown-${message.id}-${action.product.productId}`,
                        conversationId: message.conversationId,
                        messageId: message.id,
                        eventType: "cart_action_shown",
                        productId: action.product.productId,
                        variantId: action.product.variantId ?? null,
                        quantity: action.product.quantity ?? 1,
                        amount: action.product.price ? Number(action.product.price) || null : null,
                        metadata: { derivedFrom: "StorefrontChatMessage.actions", title: action.product.title },
                        createdAt: message.createdAt,
                    }),
                )
            } else if (action.type === "open_cart") {
                pushIfMissing(
                    syntheticEvent({
                        id: `derived-cart-link-${message.id}`,
                        conversationId: message.conversationId,
                        messageId: message.id,
                        eventType: "cart_link_generated",
                        productId: action.product?.productId ?? null,
                        variantId: action.product?.variantId ?? null,
                        quantity: action.product?.quantity ?? null,
                        metadata: { derivedFrom: "StorefrontChatMessage.actions" },
                        createdAt: message.createdAt,
                    }),
                )
            }
        }
    }

    const hasPersistedTicketEvents = params.persistedEvents.some((event) => event.eventType === "ticket_created")
    if (!hasPersistedTicketEvents) {
        for (const ticket of params.ticketLogs) {
            pushIfMissing(
                syntheticEvent({
                    id: `derived-ticket-${ticket.id}`,
                    eventType: "ticket_created",
                    resolutionStatus: "escalated",
                    metadata: {
                        derivedFrom: "EmailLog",
                        subject: ticket.subject,
                        preview: ticket.bodyPreview,
                    },
                    createdAt: ticket.sentAt,
                }),
            )
        }
    }

    return [...params.persistedEvents, ...derived].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
}

function median(nums: number[]): number {
    if (nums.length === 0) return 0
    const s = [...nums].sort((a, b) => a - b)
    const m = Math.floor(s.length / 2)
    return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2
}

function pct(part: number, total: number): number {
    if (total <= 0) return 0
    return Math.round((part / total) * 1000) / 10
}

function money(amount: number): number {
    return Math.round(amount * 100) / 100
}

function addToTimeline<T extends { key: string }>(
    timeline: T[],
    date: Date,
    grain: AnalyticsGrain,
    update: (row: T) => void,
) {
    const key = bucketKey(date, grain)
    const row = timeline.find((item) => item.key === key)
    if (row) update(row)
}

function productQuestionLabel(content: string): string {
    return (
        content
            .replace(/[^\w\s-]/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 70) || "Product question"
    )
}

function incrementProductQuestion(
    rows: Map<string, { name: string; count: number }>,
    name: string,
) {
    const clean = name.trim()
    if (!clean) return
    rows.set(clean, {
        name: clean,
        count: (rows.get(clean)?.count ?? 0) + 1,
    })
}

function cartEventTypes() {
    return new Set([
        "add_to_cart_clicked",
        "upsell_clicked",
        "cross_sell_clicked",
        "cart_link_opened",
        "cart_link_generated",
        "cart_action_shown",
    ])
}

export async function GET(req: Request) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }
        if (session.user.role !== "VENDOR") {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 })
        }

        const store = await getVendorActiveStore(session.user.id)
        if (!store) {
            return NextResponse.json({ message: "No active store" }, { status: 400 })
        }

        const { searchParams } = new URL(req.url)
        const window = getAnalyticsWindow({
            range: searchParams.get("range"),
            grain: searchParams.get("grain"),
        })
        const vendorUserId = store.userId
        const prismaWithAnalytics = prisma as PrismaWithAnalytics

        const [storefrontMessages, persistedAnalyticsEvents, conversations, cachedOrders, chatMessages, ticketLogs]: [
            StorefrontMessageRow[],
            AnalyticsEventRow[],
            ConversationRow[],
            CachedOrderRow[],
            ChatMessageRow[],
            TicketLogRow[],
        ] =
            await Promise.all([
                prisma.storefrontChatMessage.findMany({
                    where: {
                        conversation: { storeId: store.id },
                        createdAt: { gte: window.since, lte: window.until },
                    },
                    select: {
                        id: true,
                        senderType: true,
                        createdAt: true,
                        content: true,
                        conversationId: true,
                        actions: true,
                    },
                    orderBy: [{ conversationId: "asc" }, { createdAt: "asc" }],
                }),
                prismaWithAnalytics.aiAnalyticsEvent.findMany({
                    where: { storeId: store.id, createdAt: { gte: window.since, lte: window.until } },
                    select: {
                        id: true,
                        conversationId: true,
                        messageId: true,
                        eventType: true,
                        source: true,
                        productId: true,
                        variantId: true,
                        quantity: true,
                        amount: true,
                        currency: true,
                        sentiment: true,
                        resolutionStatus: true,
                        orderId: true,
                        attributionType: true,
                        metadata: true,
                        createdAt: true,
                    },
                    orderBy: { createdAt: "asc" },
                }),
                prisma.storefrontChatConversation.findMany({
                    where: { storeId: store.id, updatedAt: { gte: window.since } },
                    select: {
                        id: true,
                        visitorId: true,
                        customerEmail: true,
                        boundShopifyOrderId: true,
                        createdAt: true,
                        updatedAt: true,
                    },
                    orderBy: { updatedAt: "asc" },
                }),
                prisma.cachedOrder.findMany({
                    where: {
                        storeId: store.id,
                        OR: [
                            { shopifyCreatedAt: { gte: window.since, lte: window.until } },
                            { createdAt: { gte: window.since, lte: window.until } },
                        ],
                    },
                    select: {
                        shopifyOrderId: true,
                        orderNumber: true,
                        email: true,
                        totalPrice: true,
                        currency: true,
                        lineItems: true,
                        noteAttributes: true,
                        shopifyCreatedAt: true,
                        createdAt: true,
                    },
                }),
                prisma.chatMessage.findMany({
                    where: { storeId: store.id, createdAt: { gte: window.since, lte: window.until } },
                    select: { senderId: true, receiverId: true, createdAt: true },
                    orderBy: { createdAt: "asc" },
                    take: 8000,
                }),
                prisma.emailLog.findMany({
                    where: {
                        storeId: store.id,
                        trigger: "STOREFRONT_TICKET",
                        sentAt: { gte: window.since, lte: window.until },
                    },
                    select: {
                        id: true,
                        subject: true,
                        bodyPreview: true,
                        sentAt: true,
                    },
                    orderBy: { sentAt: "asc" },
                }),
            ])

        const analyticsEvents = deriveAnalyticsEventsFromExistingData({
            persistedEvents: persistedAnalyticsEvents,
            messages: storefrontMessages,
            ticketLogs,
        })

        const revenueAttribution = computeAiRevenueAttribution({
            events: analyticsEvents,
            conversations,
            orders: cachedOrders,
        })

        const timeline = emptyTimeline(window.labels, window.grain, {
            directUpsellRevenue: 0,
            directCrossSellRevenue: 0,
            aiAssistedRevenue: 0,
            questions: 0,
            resolvedByAi: 0,
            unresolvedQuestions: 0,
            ticketsCreated: 0,
            upsellShown: 0,
            upsellClicked: 0,
            cartActions: 0,
            positiveSentiment: 0,
            neutralSentiment: 0,
            negativeSentiment: 0,
            urgentSentiment: 0,
        })

        for (const event of analyticsEvents) {
            addToTimeline(timeline, event.createdAt, window.grain, (row) => {
                if (event.eventType === "customer_question") row.questions += 1
                if (event.eventType === "resolved_by_ai") row.resolvedByAi += 1
                if (event.eventType === "unresolved_question") row.unresolvedQuestions += 1
                if (event.eventType === "ticket_created") row.ticketsCreated += 1
                if (event.eventType === "upsell_shown") row.upsellShown += 1
                if (event.eventType === "upsell_clicked") row.upsellClicked += 1
                if (cartEventTypes().has(event.eventType)) row.cartActions += 1
                if (event.sentiment === "positive") row.positiveSentiment += 1
                if (event.sentiment === "neutral") row.neutralSentiment += 1
                if (event.sentiment === "negative") row.negativeSentiment += 1
                if (event.sentiment === "urgent") row.urgentSentiment += 1
            })
        }
        for (const row of revenueAttribution.directRows) {
            addToTimeline(timeline, row.createdAt, window.grain, (bucket) => {
                if (row.attributionType === "direct_upsell") bucket.directUpsellRevenue += row.amount
                if (row.attributionType === "direct_cross_sell") bucket.directCrossSellRevenue += row.amount
            })
        }
        for (const row of revenueAttribution.assistedRows) {
            addToTimeline(timeline, row.createdAt, window.grain, (bucket) => {
                bucket.aiAssistedRevenue += row.amount
            })
        }
        for (const row of timeline) {
            row.directUpsellRevenue = money(row.directUpsellRevenue)
            row.directCrossSellRevenue = money(row.directCrossSellRevenue)
            row.aiAssistedRevenue = money(row.aiAssistedRevenue)
        }

        const intentCounts: Record<string, number> = {
            WISMO: 0,
            Returns: 0,
            "Product Qs": 0,
            Shipping: 0,
            General: 0,
        }
        const productQuestionCounts = new Map<string, { name: string; count: number }>()
        const pendingByConversation = new Map<string, Date>()
        const aiLatencySeconds: number[] = []

        for (const message of storefrontMessages) {
            if (message.senderType === "CUSTOMER") {
                const bucket = classifyStorefrontCustomerQuery(message.content)
                intentCounts[bucket] += 1
                if (bucket === "Product Qs") {
                    incrementProductQuestion(productQuestionCounts, productQuestionLabel(message.content))
                }
                pendingByConversation.set(message.conversationId, message.createdAt)
            } else if (message.senderType === "AI") {
                for (const action of parseStorefrontChatActions(message.actions)) {
                    if (action.type === "add_to_cart" || action.type === "upsell_suggestion") {
                        incrementProductQuestion(productQuestionCounts, action.product.title)
                    }
                    if (action.type === "open_cart" && action.product?.title) {
                        incrementProductQuestion(productQuestionCounts, action.product.title)
                    }
                }
                const pendingAt = pendingByConversation.get(message.conversationId)
                if (!pendingAt) continue
                const sec = (message.createdAt.getTime() - pendingAt.getTime()) / 1000
                if (sec >= 0 && sec <= 3600) aiLatencySeconds.push(sec)
                pendingByConversation.delete(message.conversationId)
            }
        }

        const manualLatencyMinutes: number[] = []
        const pendingManualByCounterparty = new Map<string, Date>()
        for (const message of chatMessages) {
            if (message.receiverId === vendorUserId && message.senderId !== vendorUserId) {
                pendingManualByCounterparty.set(message.senderId, message.createdAt)
                continue
            }
            if (message.senderId === vendorUserId) {
                const pendingAt = pendingManualByCounterparty.get(message.receiverId)
                if (!pendingAt) continue
                const min = (message.createdAt.getTime() - pendingAt.getTime()) / 60_000
                if (min >= 0 && min <= 8 * 60) manualLatencyMinutes.push(min)
                pendingManualByCounterparty.delete(message.receiverId)
            }
        }

        const questions =
            analyticsEvents.filter((event) => event.eventType === "customer_question").length ||
            storefrontMessages.filter((m) => m.senderType === "CUSTOMER").length
        const aiAnswers =
            analyticsEvents.filter((event) => event.eventType === "ai_answered").length ||
            storefrontMessages.filter((m) => m.senderType === "AI").length
        const resolvedByAi = analyticsEvents.filter((event) => event.eventType === "resolved_by_ai").length
        const unresolvedQuestions = analyticsEvents.filter((event) => event.eventType === "unresolved_question").length
        const ticketsCreated = analyticsEvents.filter((event) => event.eventType === "ticket_created").length
        const cartTypes = cartEventTypes()
        const cartEvents = analyticsEvents.filter((event) => cartTypes.has(event.eventType))
        const cartClicks = cartEvents.length
        const cartOpenCount = analyticsEvents.filter((event) => event.eventType === "cart_link_opened").length
        const directOrderCount = new Set(revenueAttribution.directRows.map((row) => row.orderId)).size
        const cartConversationIds = new Set(
            cartEvents.map((event) => event.conversationId).filter((id): id is string => Boolean(id)),
        )
        const cartAttributedOrderCount = new Set(
            revenueAttribution.assistedRows
                .filter((row) => cartConversationIds.has(row.conversationId))
                .map((row) => row.orderId),
        ).size
        const conversionBase = cartConversationIds.size || cartClicks
        const currency = cachedOrders[0]?.currency ?? revenueAttribution.directRows[0]?.currency ?? "GBP"

        const sentimentTotals = {
            positive: analyticsEvents.filter((event) => event.sentiment === "positive").length,
            neutral: analyticsEvents.filter((event) => event.sentiment === "neutral").length,
            negative: analyticsEvents.filter((event) => event.sentiment === "negative").length,
            urgent: analyticsEvents.filter((event) => event.sentiment === "urgent").length,
            unknown: analyticsEvents.filter((event) => event.sentiment === "unknown").length,
        }
        const sentimentTotal = Object.values(sentimentTotals).reduce((sum, count) => sum + count, 0)
        const aiMedianSeconds = median(aiLatencySeconds)
        const manualMedianMinutes = median(manualLatencyMinutes)
        const manualBenchmarkMinutes = manualLatencyMinutes.length > 0 ? manualMedianMinutes : 3
        const minutesSavedPerAnswer = Math.min(
            10,
            Math.max(0, manualBenchmarkMinutes - aiMedianSeconds / 60),
        )
        const hoursSavedEstimate = Math.round((minutesSavedPerAnswer * aiAnswers / 60) * 10) / 10
        const topProductQuestions = Array.from(productQuestionCounts.values())
            .sort((a, b) => b.count - a.count)
            .slice(0, 25)
        const convertedProductIds = new Set(revenueAttribution.directRows.map((row) => row.productId).filter(Boolean))
        const highInterestProducts = topProductQuestions
            .filter((row) => !convertedProductIds.has(row.name))
            .slice(0, 5)

        return NextResponse.json({
            storeId: store.id,
            generatedAt: new Date().toISOString(),
            range: window.range,
            grain: window.grain,
            window: {
                since: window.since.toISOString(),
                until: window.until.toISOString(),
            },
            revenueImpact: {
                currency,
                directUpsellRevenue: money(revenueAttribution.directUpsellRevenue),
                directCrossSellRevenue: money(revenueAttribution.directCrossSellRevenue),
                aiAssistedRevenue: money(revenueAttribution.aiAssistedRevenue),
                aiCartConversionRate: pct(cartAttributedOrderCount || directOrderCount, conversionBase),
                averageAiInfluencedOrderValue:
                    revenueAttribution.assistedRows.length > 0
                        ? money(revenueAttribution.aiAssistedRevenue / revenueAttribution.assistedRows.length)
                        : 0,
                pendingAttributionCount: Math.max(0, conversionBase - (cartAttributedOrderCount || directOrderCount)),
                directRows: revenueAttribution.directRows.slice(0, 12).map((row) => ({
                    ...row,
                    createdAt: row.createdAt.toISOString(),
                })),
                assistedRows: revenueAttribution.assistedRows.slice(0, 12).map((row) => ({
                    ...row,
                    createdAt: row.createdAt.toISOString(),
                })),
                methodology:
                    "Direct upsell/cross-sell revenue only counts clicked AI-suggested products later found in matching orders. Cart conversion counts cart-engaged conversations that later match a cached Shopify order.",
            },
            customerExperience: {
                sentimentMix: {
                    totals: sentimentTotals,
                    percentages: {
                        positive: pct(sentimentTotals.positive, sentimentTotal),
                        neutral: pct(sentimentTotals.neutral, sentimentTotal),
                        negative: pct(sentimentTotals.negative, sentimentTotal),
                        urgent: pct(sentimentTotals.urgent, sentimentTotal),
                        unknown: pct(sentimentTotals.unknown, sentimentTotal),
                    },
                },
                unresolvedQuestionRate: pct(unresolvedQuestions, questions),
                escalationRate: pct(ticketsCreated, questions),
                unresolvedQuestions,
                ticketsCreated,
                negativeOrUrgent: sentimentTotals.negative + sentimentTotals.urgent,
            },
            automationOutcomes: {
                questionsAnswered: questions,
                aiAnswers,
                resolvedByAi,
                ticketsCreated,
                aiMedianSeconds: Math.round(aiMedianSeconds),
                manualMedianMinutes: Math.round(manualBenchmarkMinutes * 10) / 10,
                sampleAiPairs: aiLatencySeconds.length,
                sampleManualPairs: manualLatencyMinutes.length,
                hoursSavedEstimate,
                resolutionRate: pct(resolvedByAi, questions),
            },
            demandSignals: {
                curiousProductQuestionCount: intentCounts["Product Qs"],
                topProductQuestions,
                highInterestProducts,
                questionMix: Object.entries(intentCounts).map(([name, count]) => ({ name, count })),
            },
            timeline,
            technicalDiagnostics: {
                hiddenByDefault: true,
                storefrontAiMessages: storefrontMessages.filter((m) => m.senderType === "AI").length,
                storefrontCustomerMessages: storefrontMessages.filter((m) => m.senderType === "CUSTOMER").length,
                analyticsEvents: persistedAnalyticsEvents.length,
                derivedAnalyticsEvents: analyticsEvents.length - persistedAnalyticsEvents.length,
                cachedOrders: cachedOrders.length,
            },
            totals: {
                questions,
                aiAnswers,
                cartClicks,
                cartOpenCount,
            },
        })
    } catch (e) {
        console.error("[ai-analytics]", e)
        return NextResponse.json({ message: "Failed to load analytics" }, { status: 500 })
    }
}
