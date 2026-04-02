/**
 * Shopify ScriptTag loader (v1).
 *
 * Shopify injects this JS onto the ONLINE_STORE.
 * The script then checks our backend config for the current store and, if enabled,
 * mounts an iframe pointing to `/storefront-chat/widget?shop=...`.
 */
export async function GET() {
    const js = `
(function () {
  try {
    var script = document.currentScript;
    var baseUrl = script && script.src ? new URL(script.src).origin : window.location.origin;
    // Prefer Shopify-provided shop identifier when available.
    // On custom domains, window.location.hostname won't match the shop's myshopify domain.
    var shop =
      (window.Shopify && (window.Shopify.shop || window.Shopify.myshopifyDomain)) ||
      window.location.hostname;

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
          var url = baseUrl + "/storefront-chat/widget?shop=" + encodeURIComponent(shop);
          // Try popup first (nice for testing), fallback to new tab.
          var w = Math.min(420, Math.max(320, window.innerWidth));
          var h = Math.min(640, Math.max(480, window.innerHeight));
          var left = Math.max(0, Math.round(window.screenX + (window.outerWidth - w)));
          var top = Math.max(0, Math.round(window.screenY + (window.outerHeight - h)));
          var popup = window.open(url, "juno_storefront_chat", "popup=yes,width=" + w + ",height=" + h + ",left=" + left + ",top=" + top);
          if (!popup) window.open(url, "_blank");
        } catch (e) {
          window.open(baseUrl + "/storefront-chat/widget?shop=" + encodeURIComponent(shop), "_blank");
        }
      });

      container.appendChild(btn);
    }

    function removeWidget() {
      var container = document.getElementById(containerId);
      if (container && container.parentNode) container.parentNode.removeChild(container);
    }

    // Avoid multiple config calls if Shopify re-runs script.
    if (window.__junoStorefrontChatConfigPromise) return;
    window.__junoStorefrontChatConfigPromise = fetch(baseUrl + "/api/storefront-chat/config?shop=" + encodeURIComponent(shop))
      .then(function (r) { return r.json().catch(function(){ return {}; }); })
      .then(function (data) {
        var enabled = !!(data && data.enabled);
        if (enabled) upsertButton();
        else removeWidget();
      })
      .catch(function () {
        // Fail closed: don't render widget if config check fails.
        removeWidget();
      });
  } catch (e) {
    // Fail closed: don't render widget.
  }
})();
`.trimStart()

    return new Response(js, {
        headers: {
            "Content-Type": "application/javascript; charset=utf-8",
            "Cache-Control": "public, max-age=300"
        }
    })
}

