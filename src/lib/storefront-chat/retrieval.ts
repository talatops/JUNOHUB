import { prisma } from "@/lib/prisma"
import {
    compactText,
    isProductStatusSellable,
    metafieldsToSummary,
    primarySkuFromVariants,
    scoreByTerms,
    tokenizeSearchTerms,
} from "@/lib/ai/tools/productCatalog"

type RetrievedContextItem = {
    source: "KB" | "FAQ" | "PRODUCT"
    title: string
    content: string
    score: number
}

type ProductRow = {
    shopifyProductId?: string
    title?: string
    vendor?: string | null
    productType?: string | null
    status?: string | null
    variants?: unknown
    metafields?: unknown
}

function productPreview(product: ProductRow) {
    const variants = Array.isArray(product?.variants) ? product.variants : []
    const firstVariant = variants[0] || {}
    const price = firstVariant?.price ?? null
    const sku = primarySkuFromVariants(firstVariant ? [firstVariant] : product?.variants)
    const weight =
        firstVariant?.weight !== undefined && firstVariant?.weight !== null
            ? `${String(firstVariant.weight)}${firstVariant.weight_unit ? ` ${firstVariant.weight_unit}` : ""}`
            : ""
    const inventory = firstVariant?.inventory_quantity ?? null
    const status = product?.status || "unknown"
    const mfLine = metafieldsToSummary(product?.metafields)

    const bits = [
        `Title: ${product?.title || "Unknown"}`,
        product?.vendor ? `Vendor: ${product.vendor}` : "",
        product?.productType ? `Type: ${product.productType}` : "",
        `Status: ${status}`,
        price !== null && price !== undefined ? `Price: ${String(price)}` : "",
        sku ? `SKU: ${String(sku)}` : "",
        weight ? `Weight: ${weight}` : "",
        inventory !== null && inventory !== undefined ? `Inventory: ${String(inventory)}` : "",
        mfLine ? `Details: ${mfLine}` : "",
    ].filter(Boolean)

    return bits.join(" | ")
}

export async function getBlendedStorefrontContext(params: {
    storeId: string
    query: string
    topKb?: number
    topProducts?: number
    includeProducts?: boolean
    allowedProductIds?: string[]
}) {
    const { storeId, query, topKb = 6, topProducts = 4, includeProducts = true } = params
    const terms = tokenizeSearchTerms(query, 10)

    const kbChunks = await prisma.knowledgeChunk.findMany({
        where: { storeId },
        orderBy: { createdAt: "desc" },
        take: 120,
        select: {
            id: true,
            sourceType: true,
            content: true,
            metadata: true,
        },
    })

    const rankedKb: RetrievedContextItem[] = (kbChunks || [])
        .map((c) => {
            const score = scoreByTerms(String(c?.content || ""), terms)
            return {
                source: c?.sourceType === "FAQ" ? "FAQ" : "KB",
                title: c?.sourceType === "FAQ" ? "FAQ entry" : "Knowledge document",
                content: compactText(String(c?.content || "")),
                score,
            } as RetrievedContextItem
        })
        .filter((x: RetrievedContextItem) => x.score > 0 && x.content.length > 0)
        .sort((a: RetrievedContextItem, b: RetrievedContextItem) => b.score - a.score)
        .slice(0, topKb)

    let rankedProducts: RetrievedContextItem[] = []
    if (includeProducts) {
        const allowedIds = Array.isArray(params.allowedProductIds)
            ? params.allowedProductIds.filter(Boolean)
            : []
        if (allowedIds.length > 0) {
            const products = await prisma.cachedProduct.findMany({
                where: {
                    storeId,
                    shopifyProductId: { in: allowedIds.slice(0, 120) },
                },
                select: {
                    shopifyProductId: true,
                    title: true,
                    vendor: true,
                    productType: true,
                    status: true,
                    variants: true,
                    images: true,
                    metafields: true,
                },
            })

            rankedProducts = (products || [])
                .filter((prod) => isProductStatusSellable(prod?.status))
                .map((prod) => {
                    const text = `${prod?.title || ""} ${prod?.vendor || ""} ${prod?.productType || ""} ${metafieldsToSummary(prod?.metafields)}`
                    const score = scoreByTerms(text, terms)
                    return {
                        source: "PRODUCT",
                        title: prod?.title || "Product",
                        content: compactText(productPreview(prod)),
                        score,
                    } as RetrievedContextItem
                })
                .sort((a: RetrievedContextItem, b: RetrievedContextItem) => b.score - a.score)
                .slice(0, topProducts)
        }
    }

    return {
        items: [...rankedKb, ...rankedProducts],
        kbCount: rankedKb.length,
        productCount: rankedProducts.length,
    }
}

