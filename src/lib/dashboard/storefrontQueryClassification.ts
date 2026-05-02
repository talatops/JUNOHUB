/** Buckets for storefront customer messages (keyword heuristic over English queries). */
export type StorefrontIntentBucket = "WISMO" | "Returns" | "Product Qs" | "Shipping" | "General"

export function classifyStorefrontCustomerQuery(content: string): StorefrontIntentBucket {
    const t = content.trim().toLowerCase()
    if (!t) return "General"

    if (
        /\b(where('s| is) my order|order status|tracking number|track my order|has my order shipped|when will (my|this) order|delivery status|not received|missing package|wismo)\b/.test(
            t,
        )
    ) {
        return "WISMO"
    }
    if (/\b(return|refund|exchange|wrong item|damaged|faulty)\b/.test(t)) {
        return "Returns"
    }
    if (/\b(product|sku|size|colour|color|material|fit|in stock|availability|price)\b/.test(t)) {
        return "Product Qs"
    }
    if (/\b(shipping|delivery|courier|dispatch|address change|postcode|zip)\b/.test(t)) {
        return "Shipping"
    }
    return "General"
}
