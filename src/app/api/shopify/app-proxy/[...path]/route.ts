import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import crypto from "crypto"

function verifyShopifyProxyHmac(params: URLSearchParams, secret: string) {
    const provided = params.get("hmac") || ""
    if (!provided) return false

    const pairs: string[] = []
    params.forEach((value, key) => {
        if (key === "hmac" || key === "signature") return
        pairs.push(`${key}=${value}`)
    })
    pairs.sort()
    const message = pairs.join("&")

    const digest = crypto.createHmac("sha256", secret).update(message).digest("hex")
    return crypto.timingSafeEqual(Buffer.from(digest, "utf8"), Buffer.from(provided, "utf8"))
}

function getAppBaseUrl() {
    return (
        process.env.NEXT_PUBLIC_APP_URL ||
        process.env.AUTH_URL ||
        process.env.NEXTAUTH_URL ||
        ""
    )
        .trim()
        .replace(/\/$/, "")
}

export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
    try {
        const { path } = await params
        const pathname = (path || []).join("/")
        const url = new URL(req.url)
        const shop = (url.searchParams.get("shop") || "").trim()

        if (!shop) {
            return new NextResponse("Missing shop", { status: 400 })
        }

        // Lookup store by shopifyDomain (myshopify domain).
        const store = await prisma.store.findFirst({
            where: { shopifyDomain: shop },
            select: { id: true, shopifyApiSecret: true },
        })

        if (!store?.shopifyApiSecret) {
            return new NextResponse("Unknown store", { status: 404 })
        }

        // Verify app proxy signature (prevents third parties from hitting this endpoint).
        if (!verifyShopifyProxyHmac(url.searchParams, store.shopifyApiSecret)) {
            return new NextResponse("Invalid signature", { status: 401 })
        }

        // Only serve injector JS for now.
        if (pathname !== "widget-injector.js") {
            return new NextResponse("Not found", { status: 404 })
        }

        const appBaseUrl = getAppBaseUrl()
        if (!appBaseUrl) {
            return new NextResponse("App base URL not configured", { status: 500 })
        }

        // App proxy returns JS that opens our hosted widget in a popup/new tab.
        const js = `
(function () {
  try {
    var appBaseUrl = ${JSON.stringify(appBaseUrl)};
    var shop = ${JSON.stringify(shop)};

    var containerId = "juno-storefront-chat-container";
    var buttonId = "juno-storefront-chat-button";

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
        try {
          var url = appBaseUrl + "/storefront-chat/widget?shop=" + encodeURIComponent(shop);
          var w = Math.min(420, Math.max(320, window.innerWidth));
          var h = Math.min(640, Math.max(480, window.innerHeight));
          var left = Math.max(0, Math.round(window.screenX + (window.outerWidth - w)));
          var top = Math.max(0, Math.round(window.screenY + (window.outerHeight - h)));
          var popup = window.open(url, "juno_storefront_chat", "popup=yes,width=" + w + ",height=" + h + ",left=" + left + ",top=" + top);
          if (!popup) window.open(url, "_blank");
        } catch (e) {
          window.open(appBaseUrl + "/storefront-chat/widget?shop=" + encodeURIComponent(shop), "_blank");
        }
      });

      container.appendChild(btn);
    }

    function removeWidget() {
      var container = document.getElementById(containerId);
      if (container && container.parentNode) container.parentNode.removeChild(container);
    }

    fetch(appBaseUrl + "/api/storefront-chat/config?shop=" + encodeURIComponent(shop))
      .then(function (r) { return r.json().catch(function(){ return {}; }); })
      .then(function (data) {
        var enabled = !!(data && data.enabled);
        if (enabled) upsertButton();
        else removeWidget();
      })
      .catch(function () { removeWidget(); });
  } catch (e) {}
})();
`.trimStart()

        // If disabled, still return JS (it will remove/avoid rendering).
        // This keeps the ScriptTag simple and lets our own config control visibility.
        return new NextResponse(js, {
            status: 200,
            headers: {
                "Content-Type": "application/javascript; charset=utf-8",
                "Cache-Control": "public, max-age=60",
            },
        })
    } catch (error) {
        console.error("[APP_PROXY_WIDGET_INJECTOR]", error)
        return new NextResponse("Internal Error", { status: 500 })
    }
}

