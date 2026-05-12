import { NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import {
    storeSelectStorefrontChatApi,
    storeSelectStorefrontConversationSession,
} from "@/lib/prisma/storeSelects"
import { generateStorefrontReply } from "@/lib/ai/storefrontGroq"
import { applyRateLimit } from "@/lib/rate-limit"
import { storefrontChatPostSchema } from "@/lib/api-schemas/public"
import type { StorefrontChatActionInput } from "@/lib/api-schemas/public"
import { validationErrorResponse } from "@/lib/api-schemas/validate"
import { extractOrderNumberHints } from "@/lib/ai/gmailContext"
import { getOrderDetailForVerifiedEmail } from "@/lib/ai/tools/orderTools"
import {
    buildOpenCartAction,
    normalizeActionProduct,
    type StorefrontActionProduct,
    type StorefrontChatAction,
} from "@/lib/storefront-chat/actions"
import {
    buildCartPermalink,
    extractCartableVariants,
    formatVariantChoices,
    selectVariantForCart,
} from "@/lib/storefront-chat/cartLinks"
import { productSearchHitToActionProduct, searchProductsForStore } from "@/lib/ai/tools/productTools"
import {
    classifyAiResolution,
    classifyCustomerSentiment,
    logAiAnalyticsEvent,
    logAiAnalyticsEvents,
} from "@/lib/analytics/aiEvents"

function normalizeShopDomain(input: string) {
    return input
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//i, "")
        .replace(/\/$/, "")
}

function shopVariants(cleanDomain: string) {
    if (!cleanDomain) return []
    const v = new Set<string>()
    v.add(cleanDomain)
    v.add(`${cleanDomain}/`)
    v.add(`https://${cleanDomain}`)
    v.add(`http://${cleanDomain}`)
    return Array.from(v)
}

const STOREFRONT_TICKET_TRIGGER = "STOREFRONT_TICKET"
const ESCALATION_ALREADY_DISPATCHED_REPLY =
    "Your request is already dispatched to our human support team. Please wait for the follow-up email from our team."
const ORDER_VERIFICATION_REQUIRED_REPLY =
    "To help with order-specific requests, please verify your email first using the Order help section below."
const ORDER_NOT_FOUND_FOR_VERIFIED_EMAIL_REPLY =
    "I could not find that order for your verified email. Please double-check the order number and try again."

function formatEscalationModuleLabel(moduleName?: string): string {
    const raw = (moduleName || "CUSTOMER_SUPPORT").trim()
    return raw
        .split(/[_\s]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(" ")
}

function buildStorefrontTicketSubject(moduleName?: string): string {
    return `${formatEscalationModuleLabel(moduleName)} Request`
}

function buildOrderScopedTicketSubject(moduleName?: string, orderNumber?: string | null): string {
    const base = buildStorefrontTicketSubject(moduleName)
    const clean = (orderNumber || "").replace(/^\s*#?\s*/, "").trim()
    if (!clean) return base
    return `${base} - Order ${clean}`
}

function shouldCreateEscalationTicket(ai: { content: string; meta?: { usedTools?: string[]; module?: string } }): boolean {
    if (Array.isArray(ai.meta?.usedTools) && ai.meta.usedTools.includes("ticket_intake")) {
        return true
    }
    if (ai.meta?.module === "HUMAN_ESCALATION") {
        return true
    }
    const text = (ai.content || "").toLowerCase()
    return (
        text.includes("human will follow up") ||
        text.includes("passed your request to our team") ||
        text.includes("passed your request to the team")
    )
}

type CartResponse = {
    content: string
    actions: StorefrontChatAction[]
    pendingCartProduct: StorefrontActionProduct | null
    cartLines: StorefrontCartLine[]
}

type StorefrontCartLine = {
    variantId: string
    quantity: number
    productId?: string
    title?: string
}

function describeStorefrontAction(action: StorefrontChatActionInput | undefined) {
    if (!action) return ""
    return action.type === "upsell_suggestion" ? "Add suggested item to cart" : "Add to cart"
}

function isCartConfirmationMessage(content: string) {
    const text = content.trim().toLowerCase()
    if (!text) return false
    return /^(yes|yeah|yep|sure|ok|okay|please|do it|go ahead|add it|add to cart|buy it|i want to buy|i want it|yes please)[.! ]*$/i.test(text)
}

function isDirectAddToCartRequest(content: string) {
    const text = content.trim().toLowerCase()
    return /\b(add|put)\b.+\b(cart|bag)\b/.test(text) || /\b(buy|purchase)\b.+\b(now|it|this|product)\b/.test(text)
}

function parsePendingCartProduct(raw: unknown): StorefrontActionProduct | null {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
    const state = raw as Record<string, unknown>
    return normalizeActionProduct(state.pendingCartProduct)
}

function parseCartLines(raw: unknown): StorefrontCartLine[] {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return []
    const state = raw as Record<string, unknown>
    const lines = state.cartLines
    if (!Array.isArray(lines)) return []
    return lines
        .map((line): StorefrontCartLine | null => {
            if (!line || typeof line !== "object" || Array.isArray(line)) return null
            const row = line as Record<string, unknown>
            const variantId = typeof row.variantId === "string" ? row.variantId.trim() : ""
            if (!variantId) return null
            const quantity = Math.max(1, Math.min(10, Math.trunc(Number(row.quantity) || 1)))
            const productId = typeof row.productId === "string" ? row.productId.trim() : ""
            const title = typeof row.title === "string" ? row.title.trim() : ""
            return {
                variantId,
                quantity,
                ...(productId ? { productId } : {}),
                ...(title ? { title } : {}),
            }
        })
        .filter((line): line is StorefrontCartLine => Boolean(line))
        .slice(0, 20)
}

function mergeCartLines(existing: StorefrontCartLine[], next: StorefrontCartLine): StorefrontCartLine[] {
    const byVariant = new Map<string, StorefrontCartLine>()
    for (const line of existing) {
        byVariant.set(line.variantId, { ...line })
    }
    const previous = byVariant.get(next.variantId)
    byVariant.set(next.variantId, {
        ...previous,
        ...next,
        quantity: Math.max(1, Math.min(10, (previous?.quantity ?? 0) + next.quantity)),
    })
    return Array.from(byVariant.values()).slice(0, 20)
}

function nextL1State(
    raw: unknown,
    pendingCartProduct: StorefrontActionProduct | null,
    cartLines?: StorefrontCartLine[],
) {
    const current =
        raw && typeof raw === "object" && !Array.isArray(raw)
            ? { ...(raw as Record<string, unknown>) }
            : {}
    if (cartLines) {
        current.cartLines = cartLines
        current.cartUpdatedAt = new Date().toISOString()
    }
    if (pendingCartProduct) {
        current.pendingCartProduct = pendingCartProduct
        current.pendingCartUpdatedAt = new Date().toISOString()
    } else {
        delete current.pendingCartProduct
        delete current.pendingCartUpdatedAt
    }
    return current
}

function toJsonCompatible<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T
}

function toJsonInput(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

function imageUrlFromImages(images: unknown): string | null {
    const rows = typeof images === "string"
        ? (() => {
              try {
                  return JSON.parse(images) as unknown
              } catch {
                  return []
              }
          })()
        : images
    if (!Array.isArray(rows)) return null
    for (const row of rows) {
        if (!row || typeof row !== "object") continue
        const image = row as { src?: unknown; url?: unknown }
        const src = typeof image.src === "string" ? image.src : typeof image.url === "string" ? image.url : ""
        if (src.trim()) return src.trim()
    }
    return null
}

async function buildCartResponse(params: {
    storeId: string
    conversationId: string
    shopifyDomain: string
    productId: string
    requestedVariantId?: string | null
    quantity?: number
    message: string
    existingCartLines: StorefrontCartLine[]
    attributionSource: "primary" | "upsell" | "direct"
}): Promise<CartResponse> {
    const product = await prisma.cachedProduct.findFirst({
        where: { storeId: params.storeId, shopifyProductId: params.productId },
        select: {
            shopifyProductId: true,
            title: true,
            productType: true,
            variants: true,
            images: true,
        },
    })

    if (!product) {
        return {
            content: "I could not find that product in this store right now.",
            actions: [],
            pendingCartProduct: null,
            cartLines: params.existingCartLines,
        }
    }

    const variants = extractCartableVariants(product.variants)
    const selected = selectVariantForCart({
        variants,
        requestedVariantId: params.requestedVariantId,
        message: params.message,
    })

    if (selected.status === "invalid_variant") {
        return {
            content: "I could not verify that product option for this store. Please choose the product again.",
            actions: [],
            pendingCartProduct: null,
            cartLines: params.existingCartLines,
        }
    }

    if (selected.status === "unavailable") {
        return {
            content: `${product.title} is not available to add to cart right now.`,
            actions: [],
            pendingCartProduct: null,
            cartLines: params.existingCartLines,
        }
    }

    if (selected.status === "needs_selection") {
        return {
            content: `Which option would you like for ${product.title}? Available options include: ${formatVariantChoices(selected.variants)}.`,
            actions: [],
            pendingCartProduct: {
                productId: product.shopifyProductId,
                title: product.title,
                imageUrl: imageUrlFromImages(product.images),
                productType: product.productType,
                quantity: params.quantity ?? 1,
            },
            cartLines: params.existingCartLines,
        }
    }

    const quantity = Math.max(1, Math.min(10, Math.trunc(Number(params.quantity) || 1)))
    const actionProduct: StorefrontActionProduct = {
        productId: product.shopifyProductId,
        title: product.title,
        variantId: selected.variant.id,
        variantTitle: selected.variant.title,
        sku: selected.variant.sku,
        price: selected.variant.price,
        imageUrl: imageUrlFromImages(product.images),
        productType: product.productType,
        quantity,
    }
    const nextCartLines = mergeCartLines(params.existingCartLines, {
        variantId: selected.variant.id,
        quantity,
        productId: product.shopifyProductId,
        title: product.title,
    })
    const cartUrl = buildCartPermalink(params.shopifyDomain, nextCartLines, {
        juno_ai_conversation_id: params.conversationId,
        juno_ai_product_id: product.shopifyProductId,
        juno_ai_variant_id: selected.variant.id,
        juno_ai_source: params.attributionSource,
    })
    if (!cartUrl) {
        return {
            content: "I could not create a cart link for that product right now.",
            actions: [],
            pendingCartProduct: null,
            cartLines: params.existingCartLines,
        }
    }

    const variantText =
        selected.variant.title && !/^default title$/i.test(selected.variant.title)
            ? ` (${selected.variant.title})`
            : ""
    const cartCount = nextCartLines.reduce((sum, line) => sum + line.quantity, 0)

    return {
        content: `Added ${product.title}${variantText}. Your cart now has ${cartCount} item${cartCount === 1 ? "" : "s"}.`,
        actions: [buildOpenCartAction(cartUrl, actionProduct)],
        pendingCartProduct: null,
        cartLines: nextCartLines,
    }
}

async function resolveDirectAddToCart(params: {
    storeId: string
    conversationId: string
    shopifyDomain: string
    message: string
    existingCartLines: StorefrontCartLine[]
}): Promise<CartResponse | null> {
    if (!isDirectAddToCartRequest(params.message)) return null
    const hits = await searchProductsForStore(params.storeId, params.message, 1)
    const hit = hits[0]
    if (!hit) return null
    const product = productSearchHitToActionProduct(hit)
    return buildCartResponse({
        storeId: params.storeId,
        conversationId: params.conversationId,
        shopifyDomain: params.shopifyDomain,
        productId: hit.shopifyProductId,
        requestedVariantId: product?.variantId,
        quantity: product?.quantity ?? 1,
        message: params.message,
        existingCartLines: params.existingCartLines,
        attributionSource: "direct",
    })
}

export async function POST(req: Request) {
    try {
        const rate = await applyRateLimit(req, "public:storefront-chat", {
            windowMs: 60_000,
            maxRequests: 40,
        })
        if (!rate.success) {
            return NextResponse.json(
                { message: "Too many requests. Please try again later." },
                { status: 429 },
            )
        }

        const raw = await req.json().catch(() => ({}))
        const parsed = storefrontChatPostSchema.safeParse(raw)
        if (!parsed.success) {
            return validationErrorResponse(parsed.error)
        }
        const { shop, visitorId, content: trimmedContent, customerEmail, action } = parsed.data
        const customerContent = trimmedContent || describeStorefrontAction(action)

        const normalizedShop = normalizeShopDomain(shop)

        const variants = shopVariants(normalizedShop)
        const stores = await prisma.store.findMany({
            where: { shopifyDomain: { in: variants } },
            select: storeSelectStorefrontChatApi,
        })

        const store =
            stores.find((s) => Boolean(s.storefrontChatEnabled)) || stores[0]
        if (!store) {
            return NextResponse.json({ message: "Store not found" }, { status: 404 })
        }
        if (!store.storefrontChatEnabled) {
            return NextResponse.json({ message: "Widget disabled" }, { status: 403 })
        }

        // Find or create conversation for this anonymous visitor.
        let conversation = await prisma.storefrontChatConversation.findFirst({
            where: { storeId: store.id, visitorId },
            select: storeSelectStorefrontConversationSession,
        })

        if (conversation) {
            // Very lightweight rate limit: max 5 messages per 30 seconds per conversation.
            const windowMs = 30_000
            const recentCount = await prisma.storefrontChatMessage.count({
                where: {
                    conversationId: conversation.id,
                    createdAt: { gte: new Date(Date.now() - windowMs) },
                },
            })

            if (recentCount >= 5) {
                return NextResponse.json({ message: "Too many messages, slow down" }, { status: 429 })
            }
        } else {
            conversation = await prisma.storefrontChatConversation.create({
                data: {
                    storeId: store.id,
                    visitorId,
                    customerEmail: customerEmail ?? null,
                },
                select: storeSelectStorefrontConversationSession,
            })
        }

        const customerMessage = await prisma.storefrontChatMessage.create({
            data: {
                conversationId: conversation.id,
                senderType: "CUSTOMER",
                content: customerContent
            },
            select: { id: true, createdAt: true, senderType: true, content: true, actions: true }
        })

        void logAiAnalyticsEvents([
            {
                storeId: store.id,
                conversationId: conversation.id,
                messageId: customerMessage.id,
                eventType: "customer_question",
                sentiment: classifyCustomerSentiment(customerContent),
                metadata: {
                    actionType: action?.type ?? null,
                    contentPreview: customerContent.slice(0, 500),
                },
                createdAt: customerMessage.createdAt,
            },
            ...(action
                ? [
                      {
                          storeId: store.id,
                          conversationId: conversation.id,
                          messageId: customerMessage.id,
                          eventType:
                              action.type === "upsell_suggestion"
                                  ? ("upsell_clicked" as const)
                                  : ("add_to_cart_clicked" as const),
                          productId: action.productId,
                          variantId: action.variantId ?? null,
                          quantity: action.quantity,
                          metadata: { sourceMessageId: action.sourceMessageId ?? null },
                          createdAt: customerMessage.createdAt,
                      },
                  ]
                : []),
        ])

        const pendingCartProduct = parsePendingCartProduct(conversation.l1State)
        const existingCartLines = parseCartLines(conversation.l1State)
        const cartResponse = action
            ? await buildCartResponse({
                  storeId: store.id,
                  conversationId: conversation.id,
                  shopifyDomain: store.shopifyDomain,
                  productId: action.productId,
                  requestedVariantId: action.variantId,
                  quantity: action.quantity,
                  message: customerContent,
                  existingCartLines,
                  attributionSource: action.type === "upsell_suggestion" ? "upsell" : "primary",
              })
            : pendingCartProduct && isCartConfirmationMessage(customerContent)
              ? await buildCartResponse({
                    storeId: store.id,
                    conversationId: conversation.id,
                    shopifyDomain: store.shopifyDomain,
                    productId: pendingCartProduct.productId,
                    requestedVariantId: pendingCartProduct.variantId,
                    quantity: pendingCartProduct.quantity,
                    message: customerContent,
                    existingCartLines,
                    attributionSource: "primary",
                })
              : await resolveDirectAddToCart({
                    storeId: store.id,
                    conversationId: conversation.id,
                    shopifyDomain: store.shopifyDomain,
                    message: customerContent,
                    existingCartLines,
                })

        if (cartResponse) {
            const aiMessage = await prisma.storefrontChatMessage.create({
                data: {
                    conversationId: conversation.id,
                    senderType: "AI",
                    content: cartResponse.content,
                    actions: cartResponse.actions.length ? toJsonCompatible(cartResponse.actions) : undefined,
                },
                select: { id: true, createdAt: true, senderType: true, content: true, actions: true },
            })

            const openCartAction = cartResponse.actions.find((a) => a.type === "open_cart")
            const openCartProduct = openCartAction?.product
            void logAiAnalyticsEvents([
                {
                    storeId: store.id,
                    conversationId: conversation.id,
                    messageId: aiMessage.id,
                    eventType: "ai_answered",
                    resolutionStatus: "resolved_by_ai",
                    productId: openCartProduct?.productId ?? null,
                    variantId: openCartProduct?.variantId ?? null,
                    quantity: openCartProduct?.quantity ?? null,
                    metadata: {
                        contentPreview: cartResponse.content.slice(0, 500),
                        cartLines: cartResponse.cartLines,
                    },
                    createdAt: aiMessage.createdAt,
                },
                {
                    storeId: store.id,
                    conversationId: conversation.id,
                    messageId: aiMessage.id,
                    eventType: "cart_link_generated",
                    productId: openCartProduct?.productId ?? null,
                    variantId: openCartProduct?.variantId ?? null,
                    quantity: openCartProduct?.quantity ?? null,
                    metadata: {
                        cartUrl: openCartAction?.cartUrl ?? null,
                        cartLines: cartResponse.cartLines,
                    },
                    createdAt: aiMessage.createdAt,
                },
                {
                    storeId: store.id,
                    conversationId: conversation.id,
                    messageId: aiMessage.id,
                    eventType: "resolved_by_ai",
                    productId: openCartProduct?.productId ?? null,
                    variantId: openCartProduct?.variantId ?? null,
                    metadata: { reason: "cart_permalink_generated" },
                    createdAt: aiMessage.createdAt,
                },
            ])

            await prisma.storefrontChatConversation.update({
                where: { id: conversation.id },
                data: {
                    l1State: toJsonInput(
                        nextL1State(
                            conversation.l1State,
                            cartResponse.pendingCartProduct,
                            cartResponse.cartLines,
                        ),
                    ),
                },
            })

            return NextResponse.json({
                success: true,
                messages: [customerMessage, aiMessage],
                meta: {
                    module: "PRODUCT_FIT",
                    pillar: "K",
                    usedTools: ["cart_permalink"],
                    kbHits: 0,
                    productHits: 1,
                },
            })
        }

        const recentHistory = await prisma.storefrontChatMessage.findMany({
            where: { conversationId: conversation.id },
            orderBy: { createdAt: "desc" },
            take: 4,
            select: { senderType: true, content: true },
        })
        const historyForAi = recentHistory.reverse()

        const sessionOk =
            Boolean(conversation.emailVerifiedAt) &&
            conversation.sessionExpiresAt &&
            (conversation.sessionExpiresAt as unknown as Date).getTime() > Date.now()

        const ai = await generateStorefrontReply({
            storeId: store.id,
            storeName: store.businessName || "Our store",
            query: trimmedContent,
            visitorId,
            history: historyForAi.map((m) => ({
                senderType: m.senderType,
                content: m.content,
            })),
            aiModulesJson: store.aiModules,
            sharedFieldAnswersJson: store.sharedFieldAnswers,
            categoryMetadetailsEnabled: store.categoryMetadetailsEnabled,
            widgetVerifiedEmail: sessionOk ? conversation.assertedEmail : null,
            widgetSessionExpiresAt: sessionOk ? conversation.sessionExpiresAt : null,
            boundShopifyOrderId: conversation.boundShopifyOrderId,
        })

        const convoEmail = await prisma.storefrontChatConversation.findUnique({
            where: { id: conversation.id },
            select: { customerEmail: true },
        })
        const ticketTo =
            convoEmail?.customerEmail?.trim().toLowerCase() ||
            customerEmail?.trim().toLowerCase() ||
            `visitor+${visitorId}@storefront.local`
        const isEscalation = shouldCreateEscalationTicket(ai)
        const verifiedEmail =
            sessionOk && conversation.assertedEmail
                ? conversation.assertedEmail.trim().toLowerCase()
                : null
        const requestedOrderHint = extractOrderNumberHints(trimmedContent)[0] ?? null
        const hasOrderSpecificRequest = Boolean(requestedOrderHint)
        const verifiedOrder =
            isEscalation && verifiedEmail && requestedOrderHint
                ? await getOrderDetailForVerifiedEmail(store.id, verifiedEmail, {
                      orderNumberHint: requestedOrderHint,
                  })
                : null
        const ticketSubject = buildOrderScopedTicketSubject(ai.meta?.module, verifiedOrder?.orderNumber)

        // Security-first guardrail:
        // For order-specific requests, only escalate when the referenced order is verified for the
        // currently verified email session.
        const blockedForMissingVerification = isEscalation && hasOrderSpecificRequest && !verifiedEmail
        const blockedForOrderMismatch = isEscalation && hasOrderSpecificRequest && verifiedEmail && !verifiedOrder

        const existingEscalation =
            isEscalation && !blockedForMissingVerification && !blockedForOrderMismatch
            ? await prisma.emailLog.findFirst({
                  where: {
                      storeId: store.id,
                      trigger: STOREFRONT_TICKET_TRIGGER,
                      to: ticketTo,
                      subject: ticketSubject,
                  },
                  select: { id: true },
              })
            : null

        const alreadyEscalated = isEscalation && Boolean(existingEscalation)
        const aiContent = blockedForMissingVerification
            ? ORDER_VERIFICATION_REQUIRED_REPLY
            : blockedForOrderMismatch
              ? ORDER_NOT_FOUND_FOR_VERIFIED_EMAIL_REPLY
              : alreadyEscalated
                ? ESCALATION_ALREADY_DISPATCHED_REPLY
                : ai.content
        const aiActions = aiContent === ai.content ? ai.actions ?? [] : []

        const aiMessage = await prisma.storefrontChatMessage.create({
            data: {
                conversationId: conversation.id,
                senderType: "AI",
                content: aiContent,
                actions: aiActions.length ? toJsonCompatible(aiActions) : undefined,
            },
            select: { id: true, createdAt: true, senderType: true, content: true, actions: true }
        })

        const resolutionStatus = classifyAiResolution({
            content: aiContent,
            usedTools: ai.meta?.usedTools,
            module: ai.meta?.module,
        })
        const upsellActions = aiActions.filter((a) => a.type === "upsell_suggestion")
        void logAiAnalyticsEvents([
            {
                storeId: store.id,
                conversationId: conversation.id,
                messageId: aiMessage.id,
                eventType: "ai_answered",
                resolutionStatus,
                metadata: {
                    module: ai.meta?.module ?? null,
                    usedTools: ai.meta?.usedTools ?? [],
                    contentPreview: aiContent.slice(0, 500),
                },
                createdAt: aiMessage.createdAt,
            },
            ...(resolutionStatus === "resolved_by_ai"
                ? [
                      {
                          storeId: store.id,
                          conversationId: conversation.id,
                          messageId: aiMessage.id,
                          eventType: "resolved_by_ai" as const,
                          resolutionStatus,
                          metadata: { module: ai.meta?.module ?? null },
                          createdAt: aiMessage.createdAt,
                      },
                  ]
                : resolutionStatus === "needs_follow_up"
                  ? [
                        {
                            storeId: store.id,
                            conversationId: conversation.id,
                            messageId: aiMessage.id,
                            eventType: "unresolved_question" as const,
                            resolutionStatus,
                            metadata: { module: ai.meta?.module ?? null },
                            createdAt: aiMessage.createdAt,
                        },
                    ]
                  : []),
            ...upsellActions.map((upsell) => ({
                storeId: store.id,
                conversationId: conversation.id,
                messageId: aiMessage.id,
                eventType: "upsell_shown" as const,
                productId: upsell.product.productId,
                variantId: upsell.product.variantId ?? null,
                quantity: upsell.product.quantity ?? 1,
                amount: upsell.product.price ? Number(upsell.product.price) || null : null,
                metadata: {
                    title: upsell.product.title,
                    productType: upsell.product.productType ?? null,
                },
                createdAt: aiMessage.createdAt,
            })),
        ])

        if (aiContent === ai.content) {
            await prisma.storefrontChatConversation.update({
                where: { id: conversation.id },
                data: { l1State: toJsonInput(nextL1State(conversation.l1State, ai.pendingCartProduct ?? null)) },
            })
        }

        if (
            isEscalation &&
            !alreadyEscalated &&
            !blockedForMissingVerification &&
            !blockedForOrderMismatch
        ) {
            try {
                const owner = await prisma.store.findUnique({
                    where: { id: store.id },
                    select: { userId: true },
                })
                if (owner?.userId) {
                    await prisma.emailLog.create({
                        data: {
                            userId: owner.userId,
                            storeId: store.id,
                            to: ticketTo,
                            subject: ticketSubject,
                            bodyPreview: customerContent.slice(0, 2000),
                            isAutomated: true,
                            trigger: STOREFRONT_TICKET_TRIGGER,
                            status: "SENT",
                        },
                    })
                    void logAiAnalyticsEvent({
                        storeId: store.id,
                        conversationId: conversation.id,
                        messageId: aiMessage.id,
                        eventType: "ticket_created",
                        resolutionStatus: "escalated",
                        metadata: {
                            to: ticketTo,
                            subject: ticketSubject,
                            module: ai.meta?.module ?? null,
                        },
                    })
                }
            } catch (ticketErr) {
                console.error("[STOREFRONT_TICKET_CREATE_ERR]", ticketErr)
            }
        }

        return NextResponse.json({
            success: true,
            messages: [customerMessage, aiMessage],
            meta: ai.meta
        })
    } catch (error) {
        console.error("[STORE_FRONT_CHAT_MESSAGES_POST]", error)
        return NextResponse.json({ message: "Internal Error" }, { status: 500 })
    }
}

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url)
        const shop = searchParams.get("shop")?.trim() || ""
        const visitorId = searchParams.get("visitorId")?.trim() || ""

        if (!shop) {
            return NextResponse.json({ message: "Missing shop" }, { status: 400 })
        }
        if (!visitorId) {
            return NextResponse.json({ message: "Missing visitorId" }, { status: 400 })
        }

        const normalizedShop = normalizeShopDomain(shop)
        const variants = shopVariants(normalizedShop)
        const stores = await prisma.store.findMany({
            where: { shopifyDomain: { in: variants } },
            select: { id: true, storefrontChatEnabled: true },
        })

        const store =
            stores.find((s) => Boolean(s.storefrontChatEnabled)) || stores[0]

        if (!store) {
            return NextResponse.json({ message: "Store not found" }, { status: 404 })
        }
        if (!store.storefrontChatEnabled) {
            return NextResponse.json({ message: "Widget disabled" }, { status: 403 })
        }

        const conversation = await prisma.storefrontChatConversation.findFirst({
            where: { storeId: store.id, visitorId },
            select: { id: true },
        })

        if (!conversation) {
            return NextResponse.json({ success: true, messages: [] })
        }

        const messages = await prisma.storefrontChatMessage.findMany({
            where: { conversationId: conversation.id },
            orderBy: { createdAt: "asc" },
            take: 120,
            select: { id: true, content: true, senderType: true, createdAt: true, actions: true }
        })

        return NextResponse.json({ success: true, messages })
    } catch (error) {
        console.error("[STORE_FRONT_CHAT_MESSAGES_GET]", error)
        return NextResponse.json({ message: "Internal Error" }, { status: 500 })
    }
}

