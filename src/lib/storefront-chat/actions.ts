export type StorefrontActionProduct = {
    productId: string
    title: string
    variantId?: string
    variantTitle?: string | null
    sku?: string | null
    price?: string | null
    imageUrl?: string | null
    productType?: string | null
    quantity?: number
}

export type StorefrontAddToCartAction = {
    type: "add_to_cart"
    label: string
    source: "primary" | "upsell"
    product: StorefrontActionProduct
}

export type StorefrontUpsellSuggestionAction = {
    type: "upsell_suggestion"
    label: string
    message: string
    product: StorefrontActionProduct
}

export type StorefrontOpenCartAction = {
    type: "open_cart"
    label: string
    cartUrl: string
    product?: StorefrontActionProduct
}

export type StorefrontChatAction =
    | StorefrontAddToCartAction
    | StorefrontUpsellSuggestionAction
    | StorefrontOpenCartAction

function clampQuantity(quantity: unknown): number {
    const n = Number(quantity)
    if (!Number.isFinite(n)) return 1
    return Math.max(1, Math.min(10, Math.trunc(n)))
}

export function normalizeActionProduct(raw: unknown): StorefrontActionProduct | null {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
    const product = raw as Record<string, unknown>
    const productId = typeof product.productId === "string" ? product.productId.trim() : ""
    const title = typeof product.title === "string" ? product.title.trim() : ""
    if (!productId || !title) return null

    const variantId = typeof product.variantId === "string" ? product.variantId.trim() : ""
    const variantTitle = typeof product.variantTitle === "string" ? product.variantTitle.trim() : null
    const sku = typeof product.sku === "string" ? product.sku.trim() : null
    const price = typeof product.price === "string" ? product.price.trim() : null
    const imageUrl = typeof product.imageUrl === "string" ? product.imageUrl.trim() : null
    const productType = typeof product.productType === "string" ? product.productType.trim() : null

    return {
        productId,
        title,
        ...(variantId ? { variantId } : {}),
        variantTitle,
        sku,
        price,
        imageUrl,
        productType,
        quantity: clampQuantity(product.quantity),
    }
}

export function parseStorefrontChatActions(raw: unknown): StorefrontChatAction[] {
    if (!Array.isArray(raw)) return []
    const actions: StorefrontChatAction[] = []

    for (const item of raw.slice(0, 6)) {
        if (!item || typeof item !== "object" || Array.isArray(item)) continue
        const action = item as Record<string, unknown>
        const type = action.type
        const label = typeof action.label === "string" ? action.label.trim() : ""

        if (type === "open_cart") {
            const cartUrl = typeof action.cartUrl === "string" ? action.cartUrl.trim() : ""
            if (!label || !/^https?:\/\//i.test(cartUrl)) continue
            actions.push({
                type,
                label,
                cartUrl,
                product: normalizeActionProduct(action.product) ?? undefined,
            })
            continue
        }

        const product = normalizeActionProduct(action.product)
        if (!product || !label) continue

        if (type === "add_to_cart") {
            const source = action.source === "upsell" ? "upsell" : "primary"
            actions.push({ type, label, source, product })
            continue
        }

        if (type === "upsell_suggestion") {
            const message = typeof action.message === "string" ? action.message.trim() : ""
            if (!message) continue
            actions.push({ type, label, message, product })
        }
    }

    return actions
}

export function buildAddToCartAction(
    product: StorefrontActionProduct,
    source: "primary" | "upsell" = "primary",
): StorefrontAddToCartAction {
    return {
        type: "add_to_cart",
        label: source === "upsell" ? "Add this too" : "Add to cart",
        source,
        product: { ...product, quantity: clampQuantity(product.quantity) },
    }
}

export function buildUpsellSuggestionAction(
    product: StorefrontActionProduct,
    baseTitle: string,
): StorefrontUpsellSuggestionAction {
    return {
        type: "upsell_suggestion",
        label: "Add suggested item",
        message: `Would you like to add ${product.title} with ${baseTitle}?`,
        product: { ...product, quantity: clampQuantity(product.quantity) },
    }
}

export function buildOpenCartAction(
    cartUrl: string,
    product?: StorefrontActionProduct,
): StorefrontOpenCartAction {
    return {
        type: "open_cart",
        label: "Open cart",
        cartUrl,
        product: product ? { ...product, quantity: clampQuantity(product.quantity) } : undefined,
    }
}
