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

        const { storefrontChatEnabled } = await request.json().catch(() => ({}))
        if (typeof storefrontChatEnabled !== "boolean") {
            return NextResponse.json({ message: "Invalid storefrontChatEnabled" }, { status: 400 })
        }

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

        await prisma.store.update({
            where: { id: storeId },
            data: { storefrontChatEnabled } as any
        })

        // Best-effort: keep the PUBLISHED Shopify theme in sync with the checkbox.
        // Even if theme operations fail (missing scopes), the widget still
        // won’t render because /api/storefront-chat/config returns the flag.
        try {
            const apiVersion = "2024-01"

            const cleanDomain = (store.shopifyDomain || "")
                .trim()
                .replace(/^https?:\/\//, "")
                .replace(/\/$/, "")
                .trim()

            const accessToken = store.shopifyAccessToken

            if (cleanDomain && accessToken) {
                console.log("[STOREFRONT_CHAT_THEME_SYNC_START]", { storeId, enabled: storefrontChatEnabled, shop: cleanDomain })

                // Cleanup legacy ScriptTags from earlier implementations so storefront
                // stops loading old ngrok/app-proxy/widget-injector sources.
                const listLegacyTags = await fetch(`https://${cleanDomain}/admin/api/${apiVersion}/script_tags.json?limit=250&fields=id,src`, {
                    headers: {
                        "X-Shopify-Access-Token": accessToken,
                        "Content-Type": "application/json"
                    }
                }).then((r) => r.json().catch(() => ({}))).catch(() => ({}))
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
                        headers: { "X-Shopify-Access-Token": accessToken }
                    }).catch(() => {})
                }

                const published = await getPublishedThemeId(cleanDomain, accessToken, apiVersion)
                if (!published.ok) {
                    console.error("[STOREFRONT_CHAT_THEME_SYNC_ERR]", { storeId, status: published.status, text: published.text })
                } else {
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

                    const js = `
(function () {
  try {
    var appBaseUrl = ${JSON.stringify(appBaseUrl)};
    if (!appBaseUrl) return;
    var shop = (window.Shopify && (window.Shopify.shop || window.Shopify.myshopifyDomain)) || window.location.hostname;

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
      iframe.title = "JUNO Chat";
      iframe.src = appBaseUrl + "/storefront-chat/widget?shop=" + encodeURIComponent(shop);
      iframe.style.width = "100%";
      iframe.style.height = "100%";
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
      btn.style.background = "#4f46e5";
      btn.style.color = "#fff";
      btn.style.display = "flex";
      btn.style.alignItems = "center";
      btn.style.justifyContent = "center";
      btn.style.fontFamily = "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif";
      btn.style.fontWeight = "800";
      btn.style.letterSpacing = "-0.02em";
      btn.innerHTML = "Chat";

      btn.addEventListener("click", function () {
        openPanel();
      });

      container.appendChild(btn);
    }

    function removeWidget() {
      var container = document.getElementById(containerId);
      if (container && container.parentNode) container.parentNode.removeChild(container);
    }

    // Theme injection itself is the source of truth:
    // - ON: this script is injected in theme.liquid (show button)
    // - OFF: injected snippet is removed (button cannot render)
    removeWidget();
    upsertButton();
    ensurePanel();
  } catch (e) {}
})();
`.trimStart()

                    // Always upload/update the asset (safe & idempotent).
                    const putAsset = await putThemeAsset(cleanDomain, accessToken, apiVersion, themeId, assetKey, js)
                    if (!putAsset.ok) {
                        console.error("[STOREFRONT_CHAT_THEME_SYNC_ERR]", { storeId, step: "put_asset", status: putAsset.status, text: putAsset.text })
                    }

                    const themeLiquid = await getThemeAsset(cleanDomain, accessToken, apiVersion, themeId, themeLiquidKey)
                    if (!themeLiquid.ok) {
                        console.error("[STOREFRONT_CHAT_THEME_SYNC_ERR]", { storeId, step: "get_theme_liquid", status: themeLiquid.status, text: themeLiquid.text })
                    } else {
                        const updated = storefrontChatEnabled
                            ? upsertThemeLiquidInjection(themeLiquid.data.value, assetFilename)
                            : removeThemeLiquidInjection(themeLiquid.data.value)

                        if (!updated.updated && (updated as any).error) {
                            console.error("[STOREFRONT_CHAT_THEME_SYNC_ERR]", { storeId, step: "patch_theme_liquid", error: (updated as any).error })
                        } else if (updated.updated) {
                            const putThemeLiquid = await putThemeAsset(cleanDomain, accessToken, apiVersion, themeId, themeLiquidKey, updated.next)
                            if (!putThemeLiquid.ok) {
                                console.error("[STOREFRONT_CHAT_THEME_SYNC_ERR]", { storeId, step: "put_theme_liquid", status: putThemeLiquid.status, text: putThemeLiquid.text })
                            } else {
                                console.log("[STOREFRONT_CHAT_THEME_SYNC_OK]", { storeId, enabled: storefrontChatEnabled, themeId })
                            }
                        } else {
                            console.log("[STOREFRONT_CHAT_THEME_SYNC_OK]", { storeId, enabled: storefrontChatEnabled, themeId, changed: false })
                        }
                    }
                }
            } else {
                console.warn("[STOREFRONT_CHAT_THEME_SYNC_SKIP]", {
                    storeId,
                    cleanDomain,
                    hasAccessToken: Boolean(accessToken)
                })
            }
        } catch (scriptError) {
            console.error("[STOREFRONT_CHAT_THEME_SYNC_ERR]", scriptError)
        }

        return NextResponse.json({
            success: true,
            storefrontChatEnabled
        })
    } catch (error) {
        console.error("Error updating store settings:", error)
        return NextResponse.json(
            { message: "Failed to update store setting" },
            { status: 500 }
        )
    }
}
