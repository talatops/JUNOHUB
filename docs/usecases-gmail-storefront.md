# Gmail vs storefront widget — use-case guide

This document maps **every customer-facing module** from [`docs/req-AI.md`](req-AI.md) §3 to **how it behaves on email (Gmail integration)** vs **the storefront chat widget**. It is a companion to the spec, not a replacement: **identifiers** (`module codes`, API paths) may differ in code; **behavior** should match the pillars below.

**Legend (pillars)**

| Code | Pillar |
|------|--------|
| **K** | Knowledge (FAQ / KB / RAG; no order mutation) |
| **T** | Transactional L1 (verified identity + DB read / limited write) |
| **X** | Ticket-led (human resolves; L1 may intake + acknowledge + ticket) |
| **Cat** | Catalog metadata (DB-backed category metadetails via tools when enabled) |

---

## 1. Identity and verification (both channels)

### 1.1 Gmail (email)

| Rule | Behavior |
|------|----------|
| Identity | Customer email = **`From:`** on the message. |
| Transactional / ticket “fiber” | Only trust lookups when **`From`** matches the **customer/order email** in your DB. No servicing “someone else’s” order from the wrong inbox. |
| OTP | **Not** in v1 of the spec for email — trust is **email alignment** only. |
| Unknown email | **Generic** safe reply: do not confirm whether an order exists for another address; ask them to contact support from the **email used at checkout**. |
| Multi-order | If `From` matches **multiple** recent/open orders, **list candidates** and ask **which order** before full detail or action. |

### 1.2 Storefront widget

| Rule | Behavior |
|------|----------|
| Pure **K** (e.g. FAQ) | May answer **without** email if the module allows — no session required. |
| **T** / **X** / identity-dependent flows | **Email asserted → OTP → verified session (TTL, e.g. 1h)**. No Shopify login, no magic links. |
| After TTL | **Re-OTP** for new transactional work. |
| Session | Server-side: asserted email, verified time, expiry, optional bound order after disambiguation. |

---

## 2. Module-by-module: Gmail vs storefront

For each row: **what the customer is trying to do**, then **Gmail** vs **Widget** specifics. Modules follow [`docs/req-AI.md`](req-AI.md) §3.

---

### `ALL` — Global store context

| | Gmail | Storefront |
|---|--------|------------|
| **Role** | Informs tone, links, support channels, SLA copy in all replies. | Same: baseline context for every reply. |
| **Verification** | N/A (not a standalone intent). | N/A |
| **Notes** | Uses shared fields (brand name, support channels, tone, policy links, etc.). | Same. |

---

### `FAQ` — General policies & “how we work”

| | Gmail | Storefront |
|---|--------|------------|
| **Pillar** | **K** | **K** |
| **Typical asks** | Return window explanation, “how long do refunds take?” (policy), shipping regions. | Same; widget can be used without OTP for pure policy if FAQ module enabled. |
| **Verification** | None required for pure policy. | None for pure FAQ path per §1.2. |
| **Human** | If out of scope → suggest email or ticket. | Same. |

**Important:** Refund **policy** = **K**. Refund **status for my order** = **T** (`REFUND_STATUS`), not FAQ.

---

### `CATEGORY_METADETAILS` — Category-level details from DB sync

| | Gmail | Storefront |
|---|--------|------------|
| **Pillar** | **Cat** | **Cat** |
| **Typical asks** | “What’s the care instruction for [category]?” after product/category resolution. | Same; often needs product/SKU → category resolution. |
| **Verification** | Needed when combined with order-specific **T** flows; for pure catalog facts, product resolution may suffice. | Gated by store **`categoryMetadetailsEnabled`** (or equivalent). If **off**, fall back to KB / PDP / ticket — **do not** call category-metadetails tools. |
| **Human** | If disabled, no row, or ambiguous → KB link / ticket. | Same. |

---

### `PRODUCT_FIT` — Fit, sizing, compatibility

| | Gmail | Storefront |
|---|--------|------------|
| **Pillar** | **K** (+ optional light **T** to resolve product) | **K** (+ product resolve) |
| **Typical asks** | Sizing, voltage, device compatibility. | Same. |
| **Sources** | KB + **category metadetails** (if enabled) + product metafields/chunks. | Same. |
| **Verification** | Usually not for generic fit; if tied to “my order,” need email alignment or OTP session. | OTP if transactional coupling. |
| **Human** | Edge cases → ticket. | Same. |

---

### `STORE_LOCAL` — Hours, pickup, local

| | Gmail | Storefront |
|---|--------|------------|
| **Pillar** | **K** | **K** |
| **Typical asks** | Store hours, pickup location, BOPIS rules. | Same. |
| **Verification** | None. | None. |

---

### `FEEDBACK` — After-resolution feedback

| | Gmail | Storefront |
|---|--------|------------|
| **Pillar** | **K** | **K** |
| **Typical asks** | CSAT link, one-off survey. | Same. |
| **Verification** | Optional ticket id in context. | Same. |
| **Human** | Negative follow-up → human. | Same. |

---

### `HUMAN_ESCALATION` — “I want a person”

| | Gmail | Storefront |
|---|--------|------------|
| **Pillar** | **K** / routing | **K** / routing |
| **Typical asks** | Escalation to agent. | Same. |
| **Verification** | Context-dependent; may create ticket per policy. | May create ticket; **post-ticket** human dialogue often continues **email** per spec §0.3. |
| **Human** | Queue / human ownership. | Same. |

---

### `ORDER_STATUS` — Where is my order

| | Gmail | Storefront |
|---|--------|------------|
| **Pillar** | **T** | **T** |
| **Prerequisites** | **`From`** matches DB + **order id** (or disambiguation list). | **OTP-verified session** + order id / disambiguation. |
| **L1** | Read order state from DB; status summary. | Same. |
| **Human** | Anomaly outside playbook → ticket. | Same. |

---

### `ORDER_SUMMARY` — Receipt / recap

| | Gmail | Storefront |
|---|--------|------------|
| **Pillar** | **T** | **T** |
| **Prerequisites** | Same as order status: aligned email + order resolution. | OTP session + order resolution. |
| **L1** | Line items / totals from DB. | Same. |
| **Human** | Tax invoice edge cases → ticket if policy says. | Same. |

---

### `SHIPPING_TRACKING` — Carrier, tracking, ETA

| | Gmail | Storefront |
|---|--------|------------|
| **Pillar** | **T** | **T** |
| **Prerequisites** | Email alignment + order. | OTP + order. |
| **L1** | Tracking fields from DB for that order. | Same. |
| **Human** | Carrier claim / dispute → **X**. | Same. |

---

### `ORDER_CANCEL` — Cancel order

| | Gmail | Storefront |
|---|--------|------------|
| **Pillar** | **T** | **T** |
| **Prerequisites** | Verified identity + order + business rules. | OTP + order + rules. |
| **L1** | Eligibility + cancel **if allowed** by implementation; else KB explanation. | Same. *(JUNOHUB MVP may be read-only — see [`docs/req-AI.md`](req-AI.md) §10.)* |
| **Human** | Ambiguous / edge → **X**. | Same. |

---

### `REFUND_STATUS` — Status of *my* refund / payout

| | Gmail | Storefront |
|---|--------|------------|
| **Pillar** | **T** | **T** |
| **Prerequisites** | Verified identity + order/return reference. | OTP + references. |
| **L1** | Read refund/return state from DB **if modeled**; else templated + ticket. | Same. |
| **Human** | When data missing or dispute. | Same. |

---

### `INVENTORY_STOCK` — Is this in stock?

| | Gmail | Storefront |
|---|--------|------------|
| **Pillar** | **T** | **T** |
| **Prerequisites** | Product name / SKU; email alignment **if** tied to “my” purchase (product decision). | Session optional for anonymous stock checks per product policy; cart-specific may need OTP. |
| **L1** | Read inventory from DB. | Same. |
| **Human** | SKU disambiguation across many variants. | Same. |

---

### `NOT_RECEIVED_MARKED_DELIVERED` — Tracking says delivered, I don’t have it

| | Gmail | Storefront |
|---|--------|------------|
| **Pillar** | **X** | **X** |
| **Prerequisites** | Verified identity + order. | OTP + order. |
| **L1** | Tracking snapshot + policy snippet + **open ticket**. | Same. |
| **Human** | Carrier / claim investigation. | Same. |

---

### `SHIPMENT_STUCK_OR_DELAYED` — Not moving / very late

| | Gmail | Storefront |
|---|--------|------------|
| **Pillar** | **X** | **X** |
| **Prerequisites** | Verified identity + order. | OTP + order. |
| **L1** | Last known scan + policy + **ticket**. | Same. |
| **Human** | Carrier / ops follow-up. | Same. |

---

### `PAYMENT_PROBLEM` — Double charge, wrong amount, promo failed, etc.

| | Gmail | Storefront |
|---|--------|------------|
| **Pillar** | **X** | **X** |
| **Prerequisites** | Order-scoped: verified identity + **order reference**; some sub-intents need extra slots (last4, date). | Same where applicable. |
| **L1** | Structured intake + **ticket**; **no** automated money movement. | Same. |
| **Human** | Finance / support. | Same. |

---

### `ORDER_CHANGE` — Change address / items / qty

| | Gmail | Storefront |
|---|--------|------------|
| **Pillar** | **X** | **X** |
| **Prerequisites** | Verified identity + order + requested change. | OTP + order + change description. |
| **L1** | **Open ticket** + acknowledgement (v1: no auto-change). | Same. |
| **Human** | Feasibility decision. | Same. |

---

### `RETURN_EXCHANGE` — Start return or exchange

| | Gmail | Storefront |
|---|--------|------------|
| **Pillar** | **X** | **X** |
| **Prerequisites** | Verified identity + order (+ reason). | OTP + order (+ reason). |
| **L1** | KB policy + **ticket** (or portal link if product adds it). | Same; spec notes post-ticket dialogue often **email**. |
| **Human** | RMA / ops. | Same. |

---

### `WARRANTY` — Warranty claim

| | Gmail | Storefront |
|---|--------|------------|
| **Pillar** | **X** | **X** |
| **Prerequisites** | Verified identity + proof-of-purchase / order. | OTP + order. |
| **L1** | Intake + **ticket**. | Same. |
| **Human** | Adjudication. | Same. |

---

### `WRONG_ITEM` — Wrong / damaged / missing item

| | Gmail | Storefront |
|---|--------|------------|
| **Pillar** | **X** | **X** |
| **Prerequisites** | Verified identity + order + issue type; **email** may include **photos**. | OTP + order + issue type. |
| **L1** | Ack + policy + **ticket** with structured fields. | Same. |
| **Human** | Reship / refund / return handling. | Same. |

---

### `COMPLAINT` — Strong dissatisfaction

| | Gmail | Storefront |
|---|--------|------------|
| **Pillar** | **X** | **X** |
| **Prerequisites** | **Strict** verification same as other fiber flows. | OTP + full context. |
| **L1** | Empathetic ack + **ticket** + severity. | Same. |
| **Human** | Resolution owner. | Same. |

---

## 3. Excluded use-cases (spec § opening)

Not in scope for this framework: subscriptions/repeat orders, wholesale/B2B, account & security beyond email+OTP, VIP/loyalty, **Shopify customer login**, **magic-link** verification.

---

## 4. Quick reference — channel vs pillar

| Pillar | Gmail summary | Storefront summary |
|--------|----------------|-------------------|
| **K** | Answer from KB/RAG; `From` not required for pure policy. | FAQ may work **without** OTP; enable FAQ module. |
| **T** | **`From` = identity**; multi-order → disambiguate. | **Email + OTP + session TTL**; disambiguate orders when needed. |
| **X** | Intake + ticket; thread stays on **email**. | Intake + ticket; **ongoing human↔customer** often **email** per spec. |
| **Cat** | Category metadetails tools only if **store toggle on** + product/category resolution. | Same + OTP when combined with **T**/**X**. |

---

## 5. Testing and operations (JUNOHUB)

- **Prisma / DB:** After schema changes: `npx prisma generate`, migrate or `db push` — see [`docs/req-AI.md`](req-AI.md) §10.1.
- **Env:** `DATABASE_URL`, `GROQ_API_KEY`, embeddings/OpenAI keys as needed, `STOREFRONT_OTP_SECRET`, SMTP for real OTP mail — §10.3.
- **Store toggles:** `categoryMetadetailsEnabled`, `aiModules` JSON — §10.2.
- **Illustrative tests:** [`tests/l1/`](tests/l1/), [`tests/gmail-auto-reply/`](tests/gmail-auto-reply/).

---

## 6. Copy-paste test examples (Gmail + storefront widget)

Use these **verbatim** (or with your real order numbers / SKUs) to exercise each pillar. Replace placeholders:

| Placeholder | Meaning |
|-------------|---------|
| `YOUR_APP` | Base URL, e.g. `http://localhost:3000` |
| `YOUR_SHOP` | Store `shopifyDomain` in DB, e.g. `your-brand.myshopify.com` |
| `YOUR_ORDER` | A real order id / name that exists in **your** `CachedOrder` rows for the tester email |
| `TEST_EMAIL` | For widget OTP: an inbox you can read (or watch server logs if SMTP is dev-only) |

**Gmail:** In production, inbound mail is processed by your Gmail/Pub/Sub pipeline; the **`From:`** address must match a customer with orders when you expect **T**/**X** behavior. For **offline** checks of reply generation, see [`tests/gmail-auto-reply/scenarios.ts`](../tests/gmail-auto-reply/scenarios.ts) and `generateAutoReplyPreview` in [`src/lib/gmail/autoReplyPreview.ts`](../src/lib/gmail/autoReplyPreview.ts).

**Widget:** Open the embedded page (shop is required):

`YOUR_APP/storefront-chat/widget?shop=YOUR_SHOP`

---

### 6.1 Knowledge (**K**) — no OTP required on widget

| Use case | Gmail (`Subject` / `Body`) | Storefront (type in widget) |
|----------|----------------------------|------------------------------|
| **FAQ** — policy | **Subject:** `Return policy`<br>**Body:** `How many days do I have to return an item if I change my mind?` | Same question in one message. |
| **STORE_LOCAL** | **Subject:** `Pickup`<br>**Body:** `What are your store hours and do you offer local pickup?` | Same. |
| **PRODUCT_FIT** (KB) | **Subject:** `Sizing`<br>**Body:** `Does the medium hoodie run true to size?` | Same. |
| **HUMAN_ESCALATION** | **Subject:** `Human`<br>**Body:** `I want to speak to a real person, please.` | Same. |
| **FEEDBACK** | **Subject:** `Thanks`<br>**Body:** `Thank you for the fast delivery — great experience!` | Same (short thank-you). |

---

### 6.2 Catalog metadata (**Cat**) — `CATEGORY_METADETAILS` (toggle must be **on**)

| Use case | Gmail | Storefront |
|----------|-------|------------|
| Category-level facts | **Subject:** `Materials`<br>**Body:** `What materials are used for products in your [Category Name] line?` | Same; include a **specific product or category name** your sync has metadetails for. |

If the toggle is **off**, expect fallback to KB / generic copy, not DB category tools.

---

### 6.3 Transactional (**T**) — Gmail: `From` = order email; Widget: **OTP first**

**Gmail examples** (send from the **same email** as the order in DB):

| Use case | **Subject** | **Body** |
|----------|-------------|----------|
| **ORDER_STATUS** (needs order #) | `Order status` | `Hi, can you confirm status for order #YOUR_ORDER? Thanks.` |
| **ORDER_STATUS** (no order # → disambiguation) | `Where is my package?` | `Hi, I still haven't received anything. Can you check the status for me? Thanks.` |
| **ORDER_SUMMARY** | `Receipt` | `Please send a line-item recap for order #YOUR_ORDER.` |
| **SHIPPING_TRACKING** | `Tracking` | `What carrier and tracking number do you have for order #YOUR_ORDER?` |
| **ORDER_CANCEL** | `Cancel` | `Please cancel order #YOUR_ORDER if it has not shipped yet.` |
| **REFUND_STATUS** | `Refund status` | `Has my refund for order #YOUR_ORDER been issued yet?` |
| **INVENTORY_STOCK** | `Stock check` | `Do you have SKU YOUR-SKU in stock right now?` |

**Hint mismatch (expect “not on file” behavior):**

| **Subject** | **Body** |
|-------------|----------|
| `Order 9999` | `I need help with order #9999.` |

**Storefront — transactional flow**

1. Open `YOUR_APP/storefront-chat/widget?shop=YOUR_SHOP`.
2. **Verify email:** enter `TEST_EMAIL` → **Send code** → enter the **6-digit OTP** from email/logs → **Verify**.
3. Send a **T** message, e.g.:

`Where is order #YOUR_ORDER?`

or

`Is SKU YOUR-SKU in stock?`

Without a verified session, the app may only treat you as anonymous; OTP unlocks identity-bound tools per spec.

---

### 6.4 Ticket-led (**X**) — intake + human; same identity rules

**Gmail** (from purchaser email):

| Use case | **Subject** | **Body** |
|----------|-------------|----------|
| **NOT_RECEIVED_MARKED_DELIVERED** | `Delivered not received` | `Tracking shows delivered for order #YOUR_ORDER but I never got the package.` |
| **SHIPMENT_STUCK_OR_DELAYED** | `Shipment stuck` | `Order #YOUR_ORDER — the tracking has not updated in 10 days.` |
| **PAYMENT_PROBLEM** | `Double charge` | `I see a duplicate charge on my card for order #YOUR_ORDER. Please investigate.` |
| **ORDER_CHANGE** | `Change address` | `Can I change the shipping address on order #YOUR_ORDER?` |
| **RETURN_EXCHANGE** | `Return` | `I want to start a return for order #YOUR_ORDER — wrong size.` |
| **WARRANTY** | `Warranty` | `I need a warranty claim for the item from order #YOUR_ORDER.` |
| **WRONG_ITEM** | `Wrong item` | `Order #YOUR_ORDER arrived with the wrong color — see photos attached.` |
| **COMPLAINT** | `Complaint` | `I am very unhappy with order #YOUR_ORDER and want this escalated.` |

**Storefront:** complete **OTP** (§6.3), then paste the **same body** lines as in the table.

---

### 6.5 Storefront API (`curl`) — same payloads the widget uses

After `next dev` (or your deployed URL):

**1) Post a chat message (anonymous FAQ path)**

```bash
curl -sS -X POST "YOUR_APP/api/storefront-chat/messages" \
  -H "Content-Type: application/json" \
  -d '{"shop":"YOUR_SHOP","visitorId":"test-visitor-1","content":"What is your return policy?"}'
```

**2) Request OTP**

```bash
curl -sS -X POST "YOUR_APP/api/storefront-chat/otp/request" \
  -H "Content-Type: application/json" \
  -d '{"shop":"YOUR_SHOP","visitorId":"test-visitor-1","email":"TEST_EMAIL"}'
```

**3) Verify OTP** (replace `123456`)

```bash
curl -sS -X POST "YOUR_APP/api/storefront-chat/otp/verify" \
  -H "Content-Type: application/json" \
  -d '{"shop":"YOUR_SHOP","visitorId":"test-visitor-1","email":"TEST_EMAIL","code":"123456"}'
```

**4) Transactional message** (same `visitorId` as steps 2–3)

```bash
curl -sS -X POST "YOUR_APP/api/storefront-chat/messages" \
  -H "Content-Type: application/json" \
  -d '{"shop":"YOUR_SHOP","visitorId":"test-visitor-1","content":"Where is order #YOUR_ORDER?","customerEmail":"TEST_EMAIL"}'
```

**5) Load history**

```bash
curl -sS "YOUR_APP/api/storefront-chat/messages?shop=YOUR_SHOP&visitorId=test-visitor-1"
```

---

### 6.6 Repo-automated Gmail-style scenarios

The strings in [`tests/gmail-auto-reply/scenarios.ts`](../tests/gmail-auto-reply/scenarios.ts) are curated for **`generateAutoReplyPreview`** (e.g. counter-question when no order #, order #1002 happy path, hint mismatch #9999, off-topic weather). Run:

`npm run test` (or `npx vitest run tests/gmail-auto-reply/run.test.ts` when your DB test stack is up — see `package.json` `test:gmail-auto-reply` for the full Docker pipeline).

---

*Aligned with [`docs/req-AI.md`](req-AI.md) §0–§3, §6–§7 (module questions), and §10 (implementation).*
