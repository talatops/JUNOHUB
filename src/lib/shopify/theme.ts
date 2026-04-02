export const JUNO_STOREFRONT_CHAT_MARKER_START = "<!-- JUNO_STOREFRONT_CHAT_START -->"
export const JUNO_STOREFRONT_CHAT_MARKER_END = "<!-- JUNO_STOREFRONT_CHAT_END -->"

export function buildThemeInjectionSnippet(assetFilename: string) {
    return [
        JUNO_STOREFRONT_CHAT_MARKER_START,
        `<script src="{{ '${assetFilename}' | asset_url }}" defer></script>`,
        JUNO_STOREFRONT_CHAT_MARKER_END,
    ].join("\n")
}

export function upsertThemeLiquidInjection(themeLiquid: string, assetFilename: string) {
    const startIdx = themeLiquid.indexOf(JUNO_STOREFRONT_CHAT_MARKER_START)
    const endIdx = themeLiquid.indexOf(JUNO_STOREFRONT_CHAT_MARKER_END)
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        return { updated: false, next: themeLiquid }
    }

    const snippet = buildThemeInjectionSnippet(assetFilename) + "\n"

    const headClose = themeLiquid.lastIndexOf("</head>")
    if (headClose !== -1) {
        const next = themeLiquid.slice(0, headClose) + snippet + themeLiquid.slice(headClose)
        return { updated: true, next }
    }

    const bodyClose = themeLiquid.lastIndexOf("</body>")
    if (bodyClose !== -1) {
        const next = themeLiquid.slice(0, bodyClose) + snippet + themeLiquid.slice(bodyClose)
        return { updated: true, next }
    }

    // Give up safely: do not mutate unknown layouts.
    return { updated: false, next: themeLiquid, error: "Could not find </head> or </body> in theme.liquid" }
}

export function removeThemeLiquidInjection(themeLiquid: string) {
    const startIdx = themeLiquid.indexOf(JUNO_STOREFRONT_CHAT_MARKER_START)
    const endIdx = themeLiquid.indexOf(JUNO_STOREFRONT_CHAT_MARKER_END)
    if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
        return { updated: false, next: themeLiquid }
    }

    const afterEnd = endIdx + JUNO_STOREFRONT_CHAT_MARKER_END.length
    // Remove trailing newline if present to avoid leaving blank lines.
    const next = themeLiquid.slice(0, startIdx) + themeLiquid.slice(afterEnd).replace(/^\s*\n/, "")
    return { updated: true, next }
}

export async function shopifyFetchJson<T>(
    shopDomain: string,
    accessToken: string,
    apiVersion: string,
    path: string,
    init?: RequestInit
): Promise<{ ok: true; data: T } | { ok: false; status: number; text: string }> {
    const url = `https://${shopDomain}/admin/api/${apiVersion}${path}`
    const res = await fetch(url, {
        ...init,
        headers: {
            "X-Shopify-Access-Token": accessToken,
            "Content-Type": "application/json",
            ...(init?.headers || {}),
        },
    })

    if (!res.ok) {
        const text = await res.text().catch(() => "")
        return { ok: false, status: res.status, text }
    }

    const data = (await res.json().catch(() => ({}))) as T
    return { ok: true, data }
}

export async function getPublishedThemeId(shopDomain: string, accessToken: string, apiVersion: string) {
    const out = await shopifyFetchJson<{ themes?: Array<{ id: number; role?: string }> }>(
        shopDomain,
        accessToken,
        apiVersion,
        "/themes.json?fields=id,role"
    )
    if (!out.ok) return out
    const themes = Array.isArray(out.data.themes) ? out.data.themes : []
    const main = themes.find((t) => t?.role === "main")
    if (!main?.id) {
        return { ok: false as const, status: 404, text: "No published theme found (role=main)" }
    }
    return { ok: true as const, data: { themeId: main.id } }
}

export async function getThemeAsset(
    shopDomain: string,
    accessToken: string,
    apiVersion: string,
    themeId: number,
    assetKey: string
) {
    const out = await shopifyFetchJson<{ asset?: { key?: string; value?: string } }>(
        shopDomain,
        accessToken,
        apiVersion,
        `/themes/${themeId}/assets.json?asset[key]=${encodeURIComponent(assetKey)}`
    )
    if (!out.ok) return out
    const value = out.data?.asset?.value
    if (typeof value !== "string") {
        return { ok: false as const, status: 404, text: `Asset ${assetKey} not found or not readable` }
    }
    return { ok: true as const, data: { value } }
}

export async function putThemeAsset(
    shopDomain: string,
    accessToken: string,
    apiVersion: string,
    themeId: number,
    assetKey: string,
    assetValue: string
) {
    return await shopifyFetchJson<{ asset?: { key?: string } }>(
        shopDomain,
        accessToken,
        apiVersion,
        `/themes/${themeId}/assets.json`,
        {
            method: "PUT",
            body: JSON.stringify({ asset: { key: assetKey, value: assetValue } }),
        }
    )
}

