/**
 * Whether to send a low-stock supplier chat for this inventory observation.
 * `newQty` / `prevQty` are supplier-reported quantities (ProductSync snapshot).
 */
export function shouldSendLowStockSupplierMessage(params: {
    newQty: number
    threshold: number
    prevQty: number | null
    lastNotifiedBelowAt: Date | null
}): boolean {
    if (params.newQty >= params.threshold) {
        return false
    }
    if (
        params.lastNotifiedBelowAt != null &&
        params.prevQty !== null &&
        params.prevQty < params.threshold
    ) {
        return false
    }
    return true
}
