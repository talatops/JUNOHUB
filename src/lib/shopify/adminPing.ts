/** Normalizes Shopify admin host (e.g. strip https:// and trailing slash). */
export function cleanShopifyDomain(domain: string): string {
    return domain.trim().replace(/^https?:\/\//, "").replace(/\/$/, "").trim()
}

/**
 * Verifies an Admin API access token against the store domain (GET shop.json).
 * Single attempt; callers may retry for transient errors if needed.
 */
export async function pingShopifyAdminApi(
    cleanDomain: string,
    accessToken: string,
): Promise<{ ok: true } | { ok: false; message: string; status?: number }> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 12_000)
    try {
        const response = await fetch(`https://${cleanDomain}/admin/api/2024-01/shop.json`, {
            method: "GET",
            headers: {
                "X-Shopify-Access-Token": accessToken,
                "Content-Type": "application/json",
            },
            signal: controller.signal,
        })
        clearTimeout(timeoutId)
        if (!response.ok) {
            return {
                ok: false,
                status: response.status,
                message:
                    "Shopify did not accept this token for your store. Paste the Admin API access token from the reinstalled app (with the right scopes).",
            }
        }
        return { ok: true }
    } catch (err) {
        clearTimeout(timeoutId)
        if (err instanceof Error && err.name === "AbortError") {
            return { ok: false, message: "Connection to Shopify timed out. Try again." }
        }
        return { ok: false, message: "Could not reach Shopify. Check your network and store domain." }
    }
}
