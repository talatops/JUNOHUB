import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import {
    getPublishedThemeId,
    getThemeAsset,
    putThemeAsset,
    removeThemeLiquidInjection,
    upsertThemeLiquidInjection
} from "@/lib/shopify/theme"

/**
 * DELETE /api/stores/[storeId]
 * Delete a store for the authenticated user
 */
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ storeId: string }> }
) {
    try {
        const session = await auth()

        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        const { storeId } = await params

        if (!storeId) {
            return NextResponse.json({ message: "Store ID is required" }, { status: 400 })
        }

        // Verify the store belongs to the user
        const store = await prisma.store.findFirst({
            where: {
                id: storeId,
                userId: session.user.id
            }
        })

        if (!store) {
            return NextResponse.json({ message: "Store not found" }, { status: 404 })
        }

        // Check if this is the only store
        const storeCount = await prisma.store.count({
            where: { userId: session.user.id }
        })

        if (storeCount === 1) {
            return NextResponse.json({
                message: "Cannot delete your only store. Please add another store first."
            }, { status: 400 })
        }

        // If deleting the active store, switch to another store first
        if (store.isActive) {
            const otherStore = await prisma.store.findFirst({
                where: {
                    userId: session.user.id,
                    id: { not: storeId }
                },
                orderBy: {
                    createdAt: "desc"
                }
            })

            if (otherStore) {
                // Switch to another store
                await prisma.store.updateMany({
                    where: {
                        userId: session.user.id
                    },
                    data: {
                        isActive: false
                    }
                })

                await prisma.store.update({
                    where: { id: otherStore.id },
                    data: { isActive: true }
                })

                await prisma.user.update({
                    where: { id: session.user.id },
                    data: { activeStoreId: otherStore.id }
                })
            }
        }

        // Delete the store (cascade will handle related data)
        await prisma.store.delete({
            where: { id: storeId }
        })

        return NextResponse.json({
            success: true,
            message: "Store deleted successfully"
        })
    } catch (error) {
        console.error("Error deleting store:", error)
        return NextResponse.json(
            { message: "Failed to delete store" },
            { status: 500 }
        )
    }
}

/**
 * PATCH /api/stores/[storeId]
 * Update per-store configuration (vendor only).
 */
const ALLOWED_FONTS = new Set([
    "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
    "Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
    "Poppins, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
    "Montserrat, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
    "Nunito, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
])

const DEFAULT_CHAT_NAME = "JUNO Chat"
const DEFAULT_TAGLINE = "Ask about products"
const DEFAULT_BRAND_COLOR = "#4f46e5"
const DEFAULT_FONT = "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif"

function sanitizeColor(value: unknown) {
    if (typeof value !== "string") return DEFAULT_BRAND_COLOR
    const v = value.trim()
    return /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.test(v) ? v : DEFAULT_BRAND_COLOR
}

function sanitizeShortText(value: unknown, fallback: string, max = 64) {
    if (typeof value !== "string") return fallback
    const v = value.trim()
    if (!v) return fallback
    return v.slice(0, max)
}

function sanitizeFont(value: unknown) {
    if (typeof value !== "string") return DEFAULT_FONT
    const v = value.trim()
    return ALLOWED_FONTS.has(v) ? v : DEFAULT_FONT
}

function sanitizeLogoUrl(value: unknown) {
    if (typeof value !== "string") return null
    const v = value.trim()
    if (!v) return null
    try {
        const parsed = new URL(v)
        if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null
        return parsed.toString().slice(0, 500)
    } catch {
        return null
    }
}

function buildStorefrontScript(params: {
    appBaseUrl: string
    chatName: string
    tagline: string
    brandColor: string
    fontFamily: string
    logoUrl: string | null
}) {
    const { appBaseUrl, chatName, tagline, brandColor, fontFamily, logoUrl } = params

    return `
(function () {
  try {
    var appBaseUrl = ${JSON.stringify(appBaseUrl)};
    if (!appBaseUrl) return;
    var shop = (window.Shopify && (window.Shopify.shop || window.Shopify.myshopifyDomain)) || window.location.hostname;

    var chatName = ${JSON.stringify(chatName)};
    var tagline = ${JSON.stringify(tagline)};
    var brandColor = ${JSON.stringify(brandColor)};
    var fontFamily = ${JSON.stringify(fontFamily)};
    var logoUrl = ${JSON.stringify(logoUrl)};

    var containerId = "juno-storefront-chat-container";
    var buttonId = "juno-storefront-chat-button";
    var panelId = "juno-storefront-chat-panel";
    var backdropId = "juno-storefront-chat-backdrop";
    var closeId = "juno-storefront-chat-close";
    var iframeId = "juno-storefront-chat-iframe";

    function ensurePanel() {
      var existingPanel = document.getElementById(panelId);
      if (existingPanel) return;

      var backdrop = document.createElement("div");
      backdrop.id = backdropId;
      backdrop.style.position = "fixed";
      backdrop.style.inset = "0";
      backdrop.style.background = "rgba(2,6,23,0.28)";
      backdrop.style.backdropFilter = "blur(2px)";
      backdrop.style.zIndex = "2147483645";
      backdrop.style.display = "none";
      backdrop.addEventListener("click", function () { closePanel(); });
      document.body.appendChild(backdrop);

      var panel = document.createElement("div");
      panel.id = panelId;
      panel.style.position = "fixed";
      panel.style.bottom = "86px";
      panel.style.right = "16px";
      panel.style.width = "380px";
      panel.style.maxWidth = "calc(100vw - 24px)";
      panel.style.height = "620px";
      panel.style.maxHeight = "calc(100vh - 110px)";
      panel.style.background = "#fff";
      panel.style.border = "1px solid rgba(15,23,42,0.12)";
      panel.style.borderRadius = "16px";
      panel.style.overflow = "hidden";
      panel.style.boxShadow = "0 30px 60px rgba(2,6,23,0.28)";
      panel.style.zIndex = "2147483646";
      panel.style.display = "none";
      panel.style.fontFamily = fontFamily;

      var header = document.createElement("div");
      header.style.height = "56px";
      header.style.display = "flex";
      header.style.alignItems = "center";
      header.style.gap = "10px";
      header.style.padding = "0 12px";
      header.style.borderBottom = "1px solid rgba(15,23,42,0.08)";
      header.style.background = "#fff";

      var logoWrap = document.createElement("div");
      logoWrap.style.width = "30px";
      logoWrap.style.height = "30px";
      logoWrap.style.borderRadius = "10px";
      logoWrap.style.flexShrink = "0";
      logoWrap.style.display = "flex";
      logoWrap.style.alignItems = "center";
      logoWrap.style.justifyContent = "center";
      logoWrap.style.background = "rgba(79,70,229,0.12)";
      logoWrap.style.border = "1px solid rgba(79,70,229,0.2)";
      if (logoUrl) {
        var logo = document.createElement("img");
        logo.src = logoUrl;
        logo.alt = chatName;
        logo.style.width = "20px";
        logo.style.height = "20px";
        logo.style.objectFit = "contain";
        logoWrap.appendChild(logo);
      } else {
        logoWrap.innerHTML = "<span style=\\"font-weight:700;color:#4338ca;font-size:12px\\">J</span>";
      }
      header.appendChild(logoWrap);

      var headerText = document.createElement("div");
      headerText.style.minWidth = "0";
      headerText.innerHTML = "<div style=\\"font-size:13px;font-weight:800;color:#111827;white-space:nowrap;overflow:hidden;text-overflow:ellipsis\\">" +
        String(chatName || "Chat") +
        "</div><div style=\\"font-size:11px;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis\\">" +
        String(tagline || "") +
        "</div>";
      header.appendChild(headerText);
      panel.appendChild(header);

      var closeBtn = document.createElement("button");
      closeBtn.id = closeId;
      closeBtn.type = "button";
      closeBtn.innerHTML = "Close";
      closeBtn.setAttribute("aria-label", "Close chat");
      closeBtn.style.position = "absolute";
      closeBtn.style.top = "10px";
      closeBtn.style.right = "10px";
      closeBtn.style.zIndex = "2";
      closeBtn.style.border = "1px solid rgba(255,255,255,0.5)";
      closeBtn.style.borderRadius = "10px";
      closeBtn.style.padding = "6px 10px";
      closeBtn.style.fontSize = "12px";
      closeBtn.style.fontWeight = "700";
      closeBtn.style.color = "#ffffff";
      closeBtn.style.background = "rgba(15,23,42,0.45)";
      closeBtn.style.cursor = "pointer";
      closeBtn.addEventListener("click", function () { closePanel(); });
      panel.appendChild(closeBtn);

      var iframe = document.createElement("iframe");
      iframe.id = iframeId;
      iframe.title = chatName || "Chat";
      iframe.src = appBaseUrl + "/storefront-chat/widget?shop=" + encodeURIComponent(shop);
      iframe.style.width = "100%";
      iframe.style.height = "calc(100% - 56px)";
      iframe.style.border = "0";
      iframe.style.background = "white";
      panel.appendChild(iframe);

      document.body.appendChild(panel);
    }

    function openPanel() {
      ensurePanel();
      var panel = document.getElementById(panelId);
      var backdrop = document.getElementById(backdropId);
      if (panel) panel.style.display = "block";
      if (backdrop) backdrop.style.display = "block";
    }

    function closePanel() {
      var panel = document.getElementById(panelId);
      var backdrop = document.getElementById(backdropId);
      if (panel) panel.style.display = "none";
      if (backdrop) backdrop.style.display = "none";
    }

    function upsertButton() {
      var container = document.getElementById(containerId);
      if (!container) {
        container = document.createElement("div");
        container.id = containerId;
        container.style.position = "fixed";
        container.style.bottom = "16px";
        container.style.right = "16px";
        container.style.zIndex = "2147483647";
        container.style.width = "56px";
        container.style.height = "56px";
        document.body.appendChild(container);
      }

      var existing = document.getElementById(buttonId);
      if (existing) return;

      var btn = document.createElement("button");
      btn.id = buttonId;
      btn.type = "button";
      btn.setAttribute("aria-label", "Open chat");
      btn.style.width = "56px";
      btn.style.height = "56px";
      btn.style.borderRadius = "16px";
      btn.style.border = "0";
      btn.style.cursor = "pointer";
      btn.style.boxShadow = "0 12px 28px rgba(0,0,0,0.20)";
      btn.style.background = brandColor || "#4f46e5";
      btn.style.color = "#fff";
      btn.style.display = "flex";
      btn.style.alignItems = "center";
      btn.style.justifyContent = "center";
      btn.style.fontFamily = fontFamily;
      btn.style.fontWeight = "800";
      btn.style.letterSpacing = "-0.02em";
      btn.innerHTML = "Chat";
      btn.addEventListener("click", function () { openPanel(); });
      container.appendChild(btn);
    }

    function removeWidget() {
      var container = document.getElementById(containerId);
      var panel = document.getElementById(panelId);
      var backdrop = document.getElementById(backdropId);
      if (container && container.parentNode) container.parentNode.removeChild(container);
      if (panel && panel.parentNode) panel.parentNode.removeChild(panel);
      if (backdrop && backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
    }

    removeWidget();
    upsertButton();
    ensurePanel();
  } catch (e) {}
})();
`.trimStart()
}

async function syncStorefrontTheme(params: {
    storeId: string
    enabled: boolean
    shopifyDomain: string
    shopifyAccessToken: string
    chatName: string
    tagline: string
    brandColor: string
    fontFamily: string
    logoUrl: string | null
}) {
    const apiVersion = "2024-01"
    const cleanDomain = (params.shopifyDomain || "")
        .trim()
        .replace(/^https?:\/\//, "")
        .replace(/\/$/, "")
        .trim()
    const accessToken = params.shopifyAccessToken

    if (!cleanDomain || !accessToken) {
        console.warn("[STOREFRONT_CHAT_THEME_SYNC_SKIP]", {
            storeId: params.storeId,
            cleanDomain,
            hasAccessToken: Boolean(accessToken),
        })
        return
    }

    console.log("[STOREFRONT_CHAT_THEME_SYNC_START]", {
        storeId: params.storeId,
        enabled: params.enabled,
        shop: cleanDomain,
    })

    const listLegacyTags = await fetch(
        `https://${cleanDomain}/admin/api/${apiVersion}/script_tags.json?limit=250&fields=id,src`,
        {
            headers: {
                "X-Shopify-Access-Token": accessToken,
                "Content-Type": "application/json",
            },
        }
    ).then((r) => r.json().catch(() => ({}))).catch(() => ({}))

    const legacyTags: Array<{ id: number; src?: string }> = Array.isArray(listLegacyTags?.script_tags)
        ? listLegacyTags.script_tags
        : []
    const legacyMatches = legacyTags.filter((t) => {
        const src = typeof t?.src === "string" ? t.src : ""
        return src.includes("/storefront-chat/widget-injector") || src.includes("/apps/juno-chat/widget-injector.js")
    })
    for (const tag of legacyMatches) {
        if (!tag?.id) continue
        await fetch(`https://${cleanDomain}/admin/api/${apiVersion}/script_tags/${tag.id}.json`, {
            method: "DELETE",
            headers: { "X-Shopify-Access-Token": accessToken },
        }).catch(() => {})
    }

    const published = await getPublishedThemeId(cleanDomain, accessToken, apiVersion)
    if (!published.ok) {
        throw new Error(`Published theme fetch failed: ${published.status}`)
    }

    const themeId = published.data.themeId
    const themeLiquidKey = "layout/theme.liquid"
    const assetKey = "assets/juno-storefront-chat.js"
    const assetFilename = "juno-storefront-chat.js"

    const appBaseUrl = (
        process.env.NEXT_PUBLIC_APP_URL ||
        process.env.AUTH_URL ||
        process.env.NEXTAUTH_URL ||
        ""
    ).trim().replace(/\/$/, "")

    const js = buildStorefrontScript({
        appBaseUrl,
        chatName: params.chatName,
        tagline: params.tagline,
        brandColor: params.brandColor,
        fontFamily: params.fontFamily,
        logoUrl: params.logoUrl,
    })

    const putAsset = await putThemeAsset(cleanDomain, accessToken, apiVersion, themeId, assetKey, js)
    if (!putAsset.ok) {
        throw new Error(`Asset update failed: ${putAsset.status}`)
    }

    const themeLiquid = await getThemeAsset(cleanDomain, accessToken, apiVersion, themeId, themeLiquidKey)
    if (!themeLiquid.ok) {
        throw new Error(`Theme liquid read failed: ${themeLiquid.status}`)
    }

    const updated = params.enabled
        ? upsertThemeLiquidInjection(themeLiquid.data.value, assetFilename)
        : removeThemeLiquidInjection(themeLiquid.data.value)
    if (!updated.updated && (updated as any).error) {
        throw new Error((updated as any).error)
    }
    if (updated.updated) {
        const putThemeLiquid = await putThemeAsset(cleanDomain, accessToken, apiVersion, themeId, themeLiquidKey, updated.next)
        if (!putThemeLiquid.ok) {
            throw new Error(`Theme liquid update failed: ${putThemeLiquid.status}`)
        }
    }

    console.log("[STOREFRONT_CHAT_THEME_SYNC_OK]", { storeId: params.storeId, enabled: params.enabled, themeId })
}

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ storeId: string }> }
) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        const { storeId } = await params
        if (!storeId) {
            return NextResponse.json({ message: "Store ID is required" }, { status: 400 })
        }

        const payload = await request.json().catch(() => ({}))
        const data: Record<string, unknown> = (payload && typeof payload === "object") ? payload : {}

        // Verify store belongs to the user
        const store = await prisma.store.findFirst({
            where: {
                id: storeId,
                userId: session.user.id
            }
        })

        if (!store) {
            return NextResponse.json({ message: "Store not found" }, { status: 404 })
        }

        const nextEnabled = typeof data.storefrontChatEnabled === "boolean"
            ? data.storefrontChatEnabled
            : store.storefrontChatEnabled

        const nextChatName = sanitizeShortText(data.storefrontChatName, store.storefrontChatName || DEFAULT_CHAT_NAME, 50)
        const nextTagline = sanitizeShortText(data.storefrontChatTagline, store.storefrontChatTagline || DEFAULT_TAGLINE, 90)
        const nextBrandColor = sanitizeColor(data.storefrontChatBrandColor ?? store.storefrontChatBrandColor)
        const nextFont = sanitizeFont(data.storefrontChatFontFamily ?? store.storefrontChatFontFamily)
        const nextLogoUrl = sanitizeLogoUrl(data.storefrontChatLogoUrl ?? store.storefrontChatLogoUrl)

        const updatedStore = await prisma.store.update({
            where: { id: storeId },
            data: {
                storefrontChatEnabled: nextEnabled,
                storefrontChatName: nextChatName,
                storefrontChatTagline: nextTagline,
                storefrontChatBrandColor: nextBrandColor,
                storefrontChatFontFamily: nextFont,
                storefrontChatLogoUrl: nextLogoUrl,
            },
            select: {
                storefrontChatEnabled: true,
                storefrontChatName: true,
                storefrontChatTagline: true,
                storefrontChatBrandColor: true,
                storefrontChatFontFamily: true,
                storefrontChatLogoUrl: true,
            }
        })

        // Explicit behavior change:
        // - Enable: save only (no auto inject).
        // - Disable: remove snippet immediately to hard-stop storefront widget.
        if (!updatedStore.storefrontChatEnabled) {
            try {
                await syncStorefrontTheme({
                    storeId,
                    enabled: false,
                    shopifyDomain: store.shopifyDomain,
                    shopifyAccessToken: store.shopifyAccessToken,
                    chatName: updatedStore.storefrontChatName || DEFAULT_CHAT_NAME,
                    tagline: updatedStore.storefrontChatTagline || DEFAULT_TAGLINE,
                    brandColor: updatedStore.storefrontChatBrandColor || DEFAULT_BRAND_COLOR,
                    fontFamily: updatedStore.storefrontChatFontFamily || DEFAULT_FONT,
                    logoUrl: updatedStore.storefrontChatLogoUrl || null,
                })
            } catch (scriptError) {
                console.error("[STOREFRONT_CHAT_THEME_SYNC_ERR]", scriptError)
            }
        }

        return NextResponse.json({
            success: true,
            storefrontChatEnabled: updatedStore.storefrontChatEnabled,
            storefrontChatName: updatedStore.storefrontChatName,
            storefrontChatTagline: updatedStore.storefrontChatTagline,
            storefrontChatBrandColor: updatedStore.storefrontChatBrandColor,
            storefrontChatFontFamily: updatedStore.storefrontChatFontFamily,
            storefrontChatLogoUrl: updatedStore.storefrontChatLogoUrl,
        })
    } catch (error) {
        console.error("Error updating store settings:", error)
        return NextResponse.json(
            { message: "Failed to update store setting" },
            { status: 500 }
        )
    }
}

/**
 * POST /api/stores/[storeId]
 * Inject storefront chat snippet + JS asset using saved customization.
 */
export async function POST(
    _request: Request,
    { params }: { params: Promise<{ storeId: string }> }
) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        const { storeId } = await params
        if (!storeId) {
            return NextResponse.json({ message: "Store ID is required" }, { status: 400 })
        }

        const store = await prisma.store.findFirst({
            where: {
                id: storeId,
                userId: session.user.id,
            },
            select: {
                id: true,
                storefrontChatEnabled: true,
                storefrontChatName: true,
                storefrontChatTagline: true,
                storefrontChatBrandColor: true,
                storefrontChatFontFamily: true,
                storefrontChatLogoUrl: true,
                shopifyDomain: true,
                shopifyAccessToken: true,
            },
        })

        if (!store) {
            return NextResponse.json({ message: "Store not found" }, { status: 404 })
        }
        if (!store.storefrontChatEnabled) {
            return NextResponse.json({ message: "Enable storefront chat first" }, { status: 400 })
        }

        await syncStorefrontTheme({
            storeId: store.id,
            enabled: true,
            shopifyDomain: store.shopifyDomain,
            shopifyAccessToken: store.shopifyAccessToken,
            chatName: sanitizeShortText(store.storefrontChatName, DEFAULT_CHAT_NAME, 50),
            tagline: sanitizeShortText(store.storefrontChatTagline, DEFAULT_TAGLINE, 90),
            brandColor: sanitizeColor(store.storefrontChatBrandColor),
            fontFamily: sanitizeFont(store.storefrontChatFontFamily),
            logoUrl: sanitizeLogoUrl(store.storefrontChatLogoUrl),
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("[STOREFRONT_CHAT_INJECT_ERR]", error)
        return NextResponse.json({ message: "Failed to inject storefront chat" }, { status: 500 })
    }
}
