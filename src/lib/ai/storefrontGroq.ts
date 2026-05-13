import { logger } from "@/lib/logger"
import { runL1Orchestrator } from "@/lib/ai/orchestrator/runL1"
import { activeAiProvider } from "@/lib/ai/chatCompletion"

type HistoryMessage = {
    senderType: "CUSTOMER" | "AI"
    content: string
}

export async function generateStorefrontReply(params: {
    storeId: string
    storeName: string
    query: string
    visitorId: string
    history: HistoryMessage[]
    aiModulesJson: unknown
    sharedFieldAnswersJson?: unknown
    categoryMetadetailsEnabled?: boolean
    widgetVerifiedEmail: string | null
    widgetSessionExpiresAt: Date | null
    boundShopifyOrderId: string | null
}) {
    const startedAt = Date.now()
    const {
        storeId,
        storeName,
        query,
        visitorId,
        history,
        aiModulesJson,
        sharedFieldAnswersJson,
        categoryMetadetailsEnabled,
        widgetVerifiedEmail,
        widgetSessionExpiresAt,
        boundShopifyOrderId,
    } = params

    const result = await runL1Orchestrator({
        channel: "widget",
        storeId,
        storeName,
        message: query,
        history,
        aiModulesJson,
        sharedFieldAnswersJson,
        categoryMetadetailsEnabled,
        widgetVerifiedEmail,
        widgetSessionExpiresAt,
        boundShopifyOrderId,
    })

    logger.info("[STOREFRONT_AI_REPLY]", {
        storeId,
        visitorId,
        provider: activeAiProvider(),
        queryLength: query.length,
        kbHits: result.meta.kbHits,
        productHits: result.meta.productHits,
        allowedUpsellCount: result.meta.allowedUpsellCount ?? 0,
        latencyMs: Date.now() - startedAt,
        module: result.meta.module,
        pillar: result.meta.pillar,
    })

    return {
        content: result.text,
        actions: result.actions ?? [],
        pendingCartProduct: result.pendingCartProduct ?? null,
        meta: {
            kbHits: result.meta.kbHits,
            productHits: result.meta.productHits,
            allowedUpsellCount: result.meta.allowedUpsellCount,
            fallbackUsed: false,
            module: result.meta.module,
            pillar: result.meta.pillar,
            usedTools: result.meta.usedTools,
        },
    }
}
