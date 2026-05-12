export type CartableVariant = {
    id: string
    title: string | null
    sku: string | null
    price: string | null
    inventoryQuantity: number | null
    optionValues: string[]
}

export type VariantSelectionResult =
    | { status: "selected"; variant: CartableVariant }
    | { status: "needs_selection"; variants: CartableVariant[] }
    | { status: "invalid_variant" }
    | { status: "unavailable"; variant?: CartableVariant }

export function normalizeShopDomain(input: string) {
    return input.trim().toLowerCase().replace(/^https?:\/\//i, "").replace(/\/$/, "")
}

function cleanString(value: unknown): string | null {
    if (value === null || value === undefined) return null
    const text = String(value).trim()
    return text ? text : null
}

function cleanInventory(value: unknown): number | null {
    if (value === null || value === undefined || value === "") return null
    const n = Number(value)
    return Number.isFinite(n) ? n : null
}

function isDefaultVariantTitle(title: string | null) {
    return !title || /^default title$/i.test(title.trim())
}

function optionValuesFromVariant(variant: Record<string, unknown>, title: string | null) {
    const values = [variant.option1, variant.option2, variant.option3]
        .map(cleanString)
        .filter((v): v is string => Boolean(v))

    if (values.length > 0) return values
    return isDefaultVariantTitle(title) || !title ? [] : [title]
}

export function extractCartableVariants(rawVariants: unknown): CartableVariant[] {
    const variants =
        typeof rawVariants === "string"
            ? (() => {
                  try {
                      return JSON.parse(rawVariants) as unknown
                  } catch {
                      return []
                  }
              })()
            : rawVariants

    if (!Array.isArray(variants)) return []

    return variants
        .map((variant): CartableVariant | null => {
            if (!variant || typeof variant !== "object" || Array.isArray(variant)) return null
            const v = variant as Record<string, unknown>
            const id = cleanString(v.id)
            if (!id) return null
            const title = cleanString(v.title)
            return {
                id,
                title,
                sku: cleanString(v.sku),
                price: cleanString(v.price),
                inventoryQuantity: cleanInventory(v.inventory_quantity),
                optionValues: optionValuesFromVariant(v, title),
            }
        })
        .filter((variant): variant is CartableVariant => Boolean(variant))
}

function isKnownUnavailable(variant: CartableVariant) {
    return variant.inventoryQuantity !== null && variant.inventoryQuantity <= 0
}

function scoreVariantByMessage(variant: CartableVariant, message: string) {
    const haystack = [
        variant.title,
        variant.sku,
        ...variant.optionValues,
    ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
    const words = message
        .toLowerCase()
        .split(/[^a-z0-9]+/g)
        .map((word) => word.trim())
        .filter((word) => word.length >= 2)

    let score = 0
    for (const word of words) {
        if (haystack.includes(word)) score += 1
    }
    return score
}

export function selectVariantForCart(params: {
    variants: CartableVariant[]
    requestedVariantId?: string | null
    message?: string | null
}): VariantSelectionResult {
    const { variants, requestedVariantId, message } = params
    if (variants.length === 0) return { status: "unavailable" }

    if (requestedVariantId?.trim()) {
        const variant = variants.find((v) => v.id === requestedVariantId.trim())
        if (!variant) return { status: "invalid_variant" }
        if (isKnownUnavailable(variant)) return { status: "unavailable", variant }
        return { status: "selected", variant }
    }

    const availableVariants = variants.filter((variant) => !isKnownUnavailable(variant))
    if (availableVariants.length === 0) {
        return { status: "unavailable", variant: variants[0] }
    }

    if (availableVariants.length === 1) {
        return { status: "selected", variant: availableVariants[0] }
    }

    const allDefaultTitles = availableVariants.every((variant) => isDefaultVariantTitle(variant.title))
    if (allDefaultTitles) {
        return { status: "selected", variant: availableVariants[0] }
    }

    const cleanMessage = message?.trim() ?? ""
    if (cleanMessage) {
        const scored = availableVariants
            .map((variant) => ({ variant, score: scoreVariantByMessage(variant, cleanMessage) }))
            .sort((a, b) => b.score - a.score)
        if (scored[0]?.score && scored[0].score > (scored[1]?.score ?? 0)) {
            return { status: "selected", variant: scored[0].variant }
        }
    }

    return { status: "needs_selection", variants: availableVariants.slice(0, 8) }
}

export function buildCartPermalink(
    shopifyDomain: string,
    lines: Array<{ variantId: string; quantity?: number }>,
    attributes?: Record<string, string | number | boolean | null | undefined>,
) {
    const cleanDomain = normalizeShopDomain(shopifyDomain)
    const encodedLines = lines
        .map((line) => {
            const variantId = line.variantId.trim()
            if (!variantId) return null
            const quantity = Math.max(1, Math.min(10, Math.trunc(Number(line.quantity) || 1)))
            return `${encodeURIComponent(variantId)}:${quantity}`
        })
        .filter((line): line is string => Boolean(line))

    if (!cleanDomain || encodedLines.length === 0) return null
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(attributes ?? {})) {
        if (value === null || value === undefined || value === "") continue
        params.set(`attributes[${key}]`, String(value).slice(0, 255))
    }
    const query = params.toString()
    return `https://${cleanDomain}/cart/${encodedLines.join(",")}${query ? `?${query}` : ""}`
}

export function formatVariantChoices(variants: CartableVariant[]) {
    return variants
        .slice(0, 5)
        .map((variant) => variant.optionValues.join(" / ") || variant.title || variant.sku || variant.id)
        .join(", ")
}
