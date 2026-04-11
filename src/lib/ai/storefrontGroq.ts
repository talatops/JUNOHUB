import { logger } from "@/lib/logger"
import { runL1Orchestrator } from "@/lib/ai/orchestrator/runL1"

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
    categoryMetadetailsEnabled: boolean
    aiModulesJson: unknown
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
        categoryMetadetailsEnabled,
        aiModulesJson,
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
        categoryMetadetailsEnabled,
        aiModulesJson,
        widgetVerifiedEmail,
        widgetSessionExpiresAt,
        boundShopifyOrderId,
    })

    logger.info("[STOREFRONT_AI_REPLY]", {
        storeId,
        visitorId,
        queryLength: query.length,
        kbHits: result.meta.kbHits,
        productHits: result.meta.productHits,
        latencyMs: Date.now() - startedAt,
        module: result.meta.module,
        pillar: result.meta.pillar,
    })

    return {
        content: result.text,
        meta: {
            kbHits: result.meta.kbHits,
            productHits: result.meta.productHits,
            fallbackUsed: false,
            module: result.meta.module,
            pillar: result.meta.pillar,
            usedTools: result.meta.usedTools,
        },
    }
}
