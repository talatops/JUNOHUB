type EventLike = {
    id: string
    conversationId: string | null
    eventType: string
    productId: string | null
    variantId: string | null
    quantity: number | null
    createdAt: Date
}

type ConversationLike = {
    id: string
    customerEmail: string | null
    boundShopifyOrderId: string | null
    createdAt: Date
    updatedAt: Date
}

type OrderLike = {
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

type LineItemLike = {
    product_id?: unknown
    productId?: unknown
    variant_id?: unknown
    variantId?: unknown
    title?: unknown
    name?: unknown
    quantity?: unknown
    price?: unknown
}

export type DirectRevenueRow = {
    eventId: string
    orderId: string
    orderNumber: string
    productId: string | null
    variantId: string | null
    title: string
    amount: number
    quantity: number
    currency: string
    attributionType: "direct_upsell" | "direct_cross_sell"
    createdAt: Date
}

export type AssistedRevenueRow = {
    orderId: string
    orderNumber: string
    amount: number
    currency: string
    conversationId: string
    createdAt: Date
}

function asString(value: unknown): string | null {
    if (value === null || value === undefined) return null
    const text = String(value).trim()
    return text ? text : null
}

function asNumber(value: unknown): number {
    const n = Number(value)
    return Number.isFinite(n) ? n : 0
}

export function parseOrderLineItems(raw: unknown): Array<{
    productId: string | null
    variantId: string | null
    title: string
    quantity: number
    price: number
}> {
    if (!Array.isArray(raw)) return []
    return (raw as LineItemLike[]).map((line) => ({
        productId: asString(line.product_id ?? line.productId),
        variantId: asString(line.variant_id ?? line.variantId),
        title: asString(line.title ?? line.name) ?? "Product",
        quantity: Math.max(1, Math.trunc(asNumber(line.quantity) || 1)),
        price: asNumber(line.price),
    }))
}

function orderDate(order: OrderLike): Date {
    return order.shopifyCreatedAt ?? order.createdAt
}

function noteAttributeValue(raw: unknown, key: string): string | null {
    if (!Array.isArray(raw)) return null
    const expected = key.trim().toLowerCase()
    for (const row of raw) {
        if (!row || typeof row !== "object") continue
        const item = row as { name?: unknown; key?: unknown; value?: unknown }
        const name = asString(item.name ?? item.key)?.toLowerCase()
        if (name !== expected) continue
        return asString(item.value)
    }
    return null
}

function orderMatchesConversation(order: OrderLike, conversation: ConversationLike) {
    const attributedConversationId = noteAttributeValue(order.noteAttributes, "juno_ai_conversation_id")
    if (attributedConversationId && attributedConversationId === conversation.id) {
        return true
    }
    if (conversation.boundShopifyOrderId && conversation.boundShopifyOrderId === order.shopifyOrderId) {
        return true
    }
    const email = order.email?.trim().toLowerCase()
    const convEmail = conversation.customerEmail?.trim().toLowerCase()
    return Boolean(email && convEmail && email === convEmail)
}

export function computeAiRevenueAttribution(params: {
    events: EventLike[]
    conversations: ConversationLike[]
    orders: OrderLike[]
    attributionDays?: number
}) {
    const attributionMs = (params.attributionDays ?? 14) * 24 * 60 * 60 * 1000
    const conversationById = new Map(params.conversations.map((c) => [c.id, c]))
    const directRows: DirectRevenueRow[] = []

    const directEvents = params.events.filter(
        (event) => event.eventType === "upsell_clicked" || event.eventType === "cross_sell_clicked",
    )

    for (const event of directEvents) {
        if (!event.conversationId) continue
        const conversation = conversationById.get(event.conversationId)
        if (!conversation) continue

        const matchingOrders = params.orders.filter((order) => {
            const createdAt = orderDate(order).getTime()
            return (
                createdAt >= event.createdAt.getTime() &&
                createdAt <= event.createdAt.getTime() + attributionMs &&
                orderMatchesConversation(order, conversation)
            )
        })

        for (const order of matchingOrders) {
            for (const line of parseOrderLineItems(order.lineItems)) {
                const productMatch = event.productId && line.productId === event.productId
                const variantMatch = event.variantId && line.variantId === event.variantId
                if (!productMatch && !variantMatch) continue
                directRows.push({
                    eventId: event.id,
                    orderId: order.shopifyOrderId,
                    orderNumber: order.orderNumber,
                    productId: line.productId,
                    variantId: line.variantId,
                    title: line.title,
                    amount: Math.round(line.price * line.quantity * 100) / 100,
                    quantity: line.quantity,
                    currency: order.currency ?? "GBP",
                    attributionType:
                        event.eventType === "cross_sell_clicked" ? "direct_cross_sell" : "direct_upsell",
                    createdAt: orderDate(order),
                })
            }
        }
    }

    const aiConversationIds = new Set(
        params.events
            .filter((event) => event.eventType === "customer_question" || event.eventType === "ai_answered")
            .map((event) => event.conversationId)
            .filter((id): id is string => Boolean(id)),
    )

    const assistedRows: AssistedRevenueRow[] = []
    const seenOrders = new Set<string>()
    for (const conversation of params.conversations) {
        if (!aiConversationIds.has(conversation.id)) continue
        for (const order of params.orders) {
            if (seenOrders.has(order.shopifyOrderId)) continue
            if (!orderMatchesConversation(order, conversation)) continue
            const amount = asNumber(order.totalPrice)
            if (amount <= 0) continue
            seenOrders.add(order.shopifyOrderId)
            assistedRows.push({
                orderId: order.shopifyOrderId,
                orderNumber: order.orderNumber,
                amount: Math.round(amount * 100) / 100,
                currency: order.currency ?? "GBP",
                conversationId: conversation.id,
                createdAt: orderDate(order),
            })
        }
    }

    return {
        directRows,
        assistedRows,
        directUpsellRevenue: directRows
            .filter((row) => row.attributionType === "direct_upsell")
            .reduce((sum, row) => sum + row.amount, 0),
        directCrossSellRevenue: directRows
            .filter((row) => row.attributionType === "direct_cross_sell")
            .reduce((sum, row) => sum + row.amount, 0),
        aiAssistedRevenue: assistedRows.reduce((sum, row) => sum + row.amount, 0),
    }
}
