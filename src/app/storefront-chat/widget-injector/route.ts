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
    var shop = window.location.hostname;

    var containerId = "juno-storefront-chat-container";
    var iframeId = "juno-storefront-chat-iframe";

    function upsertIframe() {
      var container = document.getElementById(containerId);
      if (!container) {
        container = document.createElement("div");
        container.id = containerId;
        container.style.position = "fixed";
        container.style.bottom = "16px";
        container.style.right = "16px";
        container.style.zIndex = "2147483647";
        container.style.width = "420px";
        container.style.maxWidth = "calc(100vw - 32px)";
        container.style.height = "640px";
        container.style.maxHeight = "calc(100vh - 32px)";
        container.style.borderRadius = "16px";
        document.body.appendChild(container);
      }

      var existing = document.getElementById(iframeId);
      if (existing) return;

      var iframe = document.createElement("iframe");
      iframe.id = iframeId;
      iframe.title = "JUNO Storefront Chat";
      iframe.style.border = "0";
      iframe.style.width = "100%";
      iframe.style.height = "100%";
      iframe.style.borderRadius = "16px";
      iframe.style.overflow = "hidden";
      iframe.allow = "clipboard-write; fullscreen";
      iframe.referrerPolicy = "no-referrer";
      iframe.src = baseUrl + "/storefront-chat/widget?shop=" + encodeURIComponent(shop);
      container.appendChild(iframe);
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
        if (enabled) upsertIframe();
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

