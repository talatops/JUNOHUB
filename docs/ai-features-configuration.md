# AI features — configuration and flows (high level)

This document describes how customer-facing AI is wired today: entry points, major pipeline steps, configuration stored on `Store`, and known gaps. Use it when changing ticket creation, Gmail behavior, or module gating.

## Surfaces

| Surface | Primary code | Notes |
|--------|----------------|------|
| **Gmail inbound** | [`src/lib/gmail/emailProcessor.ts`](../src/lib/gmail/emailProcessor.ts), webhook [`src/app/api/webhooks/gmail/route.ts`](../src/app/api/webhooks/gmail/route.ts) | Processes one unread message; builds a reply via [`generateAutoReplyPreview`](../src/lib/gmail/autoReplyPreview.ts) and sends it. |
| **Storefront widget** | [`src/app/api/storefront-chat/messages/route.ts`](../src/app/api/storefront-chat/messages/route.ts), [`src/lib/ai/storefrontGroq.ts`](../src/lib/ai/storefrontGroq.ts) | Public API; resolves store by `shop` domain; runs the same L1 orchestrator as email with `channel: "widget"`. |

## Gmail reply composition (`generateAutoReplyPreview`)

Rough order:

1. **Safety** — [`screenInboundEmailForAbuse`](../src/lib/ai/gmailSafety.ts); flagged messages get a minimal HTML response and no order data.
2. **Classification** — [`classifyCustomerEmail`](../src/lib/ai/gmailGroq.ts) (Groq) yields Gmail intent/mood for logging and guardrails; order-context lines are built with heuristics in the same file (when to load cached orders, when to ask for order number first, off-topic detection, etc.).
3. **L1 orchestrator** — If not skipped (off-topic, too sparse, needs order id first, hint unmatched), [`runL1Orchestrator`](../src/lib/ai/orchestrator/runL1.ts) runs with `channel: "email"` and `emailFrom` set to the sender.
4. **HTML fallbacks** — If L1 returns empty text, built-in HTML snippets apply (off-topic boundary, need order id, hint unmatched, minimal acknowledgment). Vendor-editable HTML templates were removed; there is no DB template fallback.

Relevant store fields on this path: `businessName`, `email`, `aiModules`, `modulePolicies` (see below).

## L1 orchestrator (`runL1Orchestrator`)

Single implementation for **widget** and **email**:

1. **Retrieval** — [`getBlendedStorefrontContext`](../src/lib/storefront-chat/retrieval.ts) always retrieves KB/FAQ and only includes products when the active module allows it. In strict mode, product retrieval is constrained to linked upsell candidates.
2. **Intent → module** — [`routeCustomerIntent`](../src/lib/ai/orchestrator/intentRouter.ts) (Groq JSON) maps the customer message to an [`L1Module`](../src/lib/ai/orchestrator/types.ts).
3. **Module gating** — [`parseAiModulesJson`](../src/lib/ai/orchestrator/aiModules.ts) + [`isModuleEnabled`](../src/lib/ai/orchestrator/aiModules.ts). Disabled modules fall back to **FAQ**. **`FAQ` is always treated as enabled** (cannot be turned off via JSON). **`UNKNOWN`** stays enabled for routing stability.
4. **Pillar** — Each module has a pillar in [`MODULE_MANIFESTS`](../src/lib/ai/orchestrator/manifests.ts): `K` (knowledge), `T` (transactional / DB), `X` (ticket handoff copy), `CAT` (catalog metafields).
5. **Verification** — Widget: OTP-verified session on [`StorefrontChatConversation`](../prisma/schema.prisma) (asserted email + expiry). Email: trust `From` as customer email for order lookup (see `runL1` and order tools).
6. **Tools** — Orders: [`orderTools`](../src/lib/ai/tools/orderTools.ts). Products: [`productTools`](../src/lib/ai/tools/productTools.ts). Linked upsell allowlist: [`upsellLinks`](../src/lib/ai/tools/upsellLinks.ts) backed by `UpsellProductLink` + optional `juno.upsell_links` metafields.
7. **Reply** — Mostly [`composeReply`](../src/lib/ai/orchestrator/runL1.ts) (Groq) over assembled facts. Strict guardrails prevent recommending products outside linked allowlist and strip generic upsell language when no linked candidates exist.

Vendor UI for `aiModules` and `modulePolicies`: dashboard **JUNO Engine → Modules**; persistence via `GET`/`PATCH` [`/api/stores/[storeId]`](../src/app/api/stores/[storeId]/route.ts).

## Knowledge base (separate from module toggles)

- **Mode and content** — [`Store.knowledgeBaseMode`](../prisma/schema.prisma), `knowledgeTemplate` JSON, documents, FAQs, structured chunks. APIs under [`src/app/api/stores/[storeId]/knowledge-template`](../src/app/api/stores/[storeId]/knowledge-template/route.ts) and KB subroutes.
- **Public query** — e.g. [`src/app/api/stores/[storeId]/kb/query/route.ts`](../src/app/api/stores/[storeId]/kb/query/route.ts) for RAG-style use.

Module toggles do **not** turn off the knowledge base; they only restrict which **L1 modules** can run after routing.

## Known gaps (intentional follow-ups)

1. **Ticket-led (`X`) flows** — Vendor **Tickets** are derived from [`EmailLog`](../src/app/api/juno-engine/tickets/route.ts), not a separate ticket table. Storefront escalations now persist the full storefront transcript and conversation linkage metadata on the `EmailLog` row.
2. **Spec vs router** — Vendor policy text is stored per [`L1Module`](../src/lib/ai/orchestrator/types.ts) in `Store.modulePolicies` (AI modules UI). The [`intentRouter`](../src/lib/ai/orchestrator/intentRouter.ts) only emits declared modules. Extending automation requires adding a module in types, `MODULE_MANIFESTS`, `DEFAULT_ENABLED` in `aiModules.ts`, and orchestrator branches in `runL1.ts`.
3. **Gmail vs widget parity** — Same L1 core; Gmail adds a pre-L1 classification layer and different skip rules for when L1 runs.

## Environment / models

- Groq and related env vars are used by `groqClient`, `gmailGroq`, `intentRouter`, and `composeReply`.
- Rate limits and leases for Gmail inbound: [`gmailAutoReplyGuards`](../src/lib/gmail/gmailAutoReplyGuards.ts).
- Upsell safety flags:
  - `STRICT_UPSELL_LINKS` (default `true`) blocks out-of-policy upsells.
  - `L1_INCLUDE_PRODUCT_RETRIEVAL` (default `true`) controls whether product snippets can enter retrieval context (still module-gated).
