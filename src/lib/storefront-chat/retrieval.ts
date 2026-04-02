import { prisma } from "@/lib/prisma"

type RetrievedContextItem = {
    source: "KB" | "FAQ" | "PRODUCT"
    title: string
    content: string
    score: number
}

/** Strip generic words so "do you have socks?" does not match random KB via "you"/"do". */
const STOPWORDS = new Set([
    "the",
    "a",
    "an",
    "and",
    "or",
    "but",
    "in",
    "on",
    "at",
    "to",
    "for",
    "of",
    "as",
    "by",
    "with",
    "from",
    "is",
    "are",
    "was",
    "were",
    "be",
    "been",
    "being",
    "have",
    "has",
    "had",
    "do",
    "does",
    "did",
    "will",
    "would",
    "could",
    "should",
    "may",
    "might",
    "must",
    "can",
    "this",
    "that",
    "these",
    "those",
    "i",
    "me",
    "my",
    "you",
    "your",
    "it",
    "its",
    "we",
    "our",
    "they",
    "them",
    "their",
    "what",
    "which",
    "who",
    "whom",
    "whose",
    "where",
    "when",
    "why",
    "how",
    "all",
    "each",
    "every",
    "both",
    "few",
    "more",
    "most",
    "other",
    "some",
    "such",
    "no",
    "nor",
    "not",
    "only",
    "own",
    "same",
    "so",
    "than",
    "too",
    "very",
    "just",
    "any",
    "there",
    "here",
    "about",
    "into",
    "through",
    "during",
    "before",
    "after",
    "above",
    "below",
    "between",
    "under",
    "again",
    "further",
    "then",
    "once",
    "please",
    "thanks",
    "thank",
    "hello",
    "hi",
    "hey",
    "yes",
    "no",
    "tell",
    "give",
    "get",
    "got",
])

function tokenize(text: string) {
    return text
        .toLowerCase()
        .split(/[^a-z0-9]+/g)
        .map((t) => t.trim())
        .filter((t) => t.length >= 2 && !STOPWORDS.has(t))
}

function scoreByTerms(text: string, terms: string[]) {
    if (!text || !terms.length) return 0
    const hay = text.toLowerCase()
    let score = 0
    for (const t of terms) {
        if (hay.includes(t)) score += 1
    }
    return score
}

function compact(value: string, max = 420) {
    if (value.length <= max) return value
    return `${value.slice(0, max - 1)}...`
}

function productPreview(product: any) {
    const variants = Array.isArray(product?.variants) ? product.variants : []
    const firstVariant = variants[0] || {}
    const price = firstVariant?.price ?? null
    const sku = firstVariant?.sku ?? null
    const inventory = firstVariant?.inventory_quantity ?? null
    const status = product?.status || "unknown"

    const bits = [
        `Title: ${product?.title || "Unknown"}`,
        product?.vendor ? `Vendor: ${product.vendor}` : "",
        product?.productType ? `Type: ${product.productType}` : "",
        `Status: ${status}`,
        price !== null && price !== undefined ? `Price: ${String(price)}` : "",
        sku ? `SKU: ${String(sku)}` : "",
        inventory !== null && inventory !== undefined ? `Inventory: ${String(inventory)}` : "",
    ].filter(Boolean)

    return bits.join(" | ")
}

export async function getBlendedStorefrontContext(params: {
    storeId: string
    query: string
    topKb?: number
    topProducts?: number
}) {
    const { storeId, query, topKb = 6, topProducts = 4 } = params
    const terms = tokenize(query).slice(0, 10)

    const p = prisma as any

    const kbChunks = await p.knowledgeChunk.findMany({
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
        .map((c: any) => {
            const score = scoreByTerms(String(c?.content || ""), terms)
            return {
                source: c?.sourceType === "FAQ" ? "FAQ" : "KB",
                title: c?.sourceType === "FAQ" ? "FAQ entry" : "Knowledge document",
                content: compact(String(c?.content || "")),
                score,
            } as RetrievedContextItem
        })
        .filter((x: RetrievedContextItem) => x.score > 0 && x.content.length > 0)
        .sort((a: RetrievedContextItem, b: RetrievedContextItem) => b.score - a.score)
        .slice(0, topKb)

    const products = await p.cachedProduct.findMany({
        where: { storeId },
        orderBy: { updatedAt: "desc" },
        take: 200,
        select: {
            title: true,
            vendor: true,
            productType: true,
            status: true,
            variants: true,
            images: true,
        },
    })

    const rankedProducts: RetrievedContextItem[] = (products || [])
        .map((prod: any) => {
            const text = `${prod?.title || ""} ${prod?.vendor || ""} ${prod?.productType || ""}`
            const score = scoreByTerms(text, terms)
            return {
                source: "PRODUCT",
                title: prod?.title || "Product",
                content: compact(productPreview(prod)),
                score,
            } as RetrievedContextItem
        })
        .filter((x: RetrievedContextItem) => x.score > 0)
        .sort((a: RetrievedContextItem, b: RetrievedContextItem) => b.score - a.score)
        .slice(0, topProducts)

    return {
        items: [...rankedKb, ...rankedProducts],
        kbCount: rankedKb.length,
        productCount: rankedProducts.length,
    }
}

