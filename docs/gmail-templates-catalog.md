# Gmail auto-reply templates — full catalog (manual setup)

Use this document to create **one saved template per row** in **JUNO Engine → Email templates** for your **active store**.  
Exact `**intent`** and `**mood**` strings must match the tables below so `findTemplateWithFallback` can select them.

After these exist, **Gmail auto-replies use only saved templates** (plus a minimal fallback if none match). Groq is still used for **classification** (intent/mood) only — it does **not** draft replies or insert new `Template` rows. Include `{{order_summary}}` in bodies so order context from cache appears in the reply.

---

## 1. `Template` schema (Prisma)


| Field         | Type          | Notes                                                         |
| ------------- | ------------- | ------------------------------------------------------------- |
| `id`          | String (cuid) | Auto-generated when you create in UI                          |
| `storeId`     | String        | Your **active store** id (set by the app)                     |
| `name`        | String        | Human-readable label in the UI                                |
| `intent`      | String        | One of **Allowed intents** below                              |
| `mood`        | String        | One of **Allowed moods** below                                |
| `description` | String?       | Optional internal note                                        |
| `body`        | String        | HTML or text; supports `{{variables}}` (see §3)               |
| `variables`   | Json?         | Optional metadata (e.g. `{"seed":"gmail-templates-catalog"}`) |
| `isHtml`      | Boolean       | Use `**true`** for the bodies in this file                    |


---

## 2. Allowed intents and moods (must match exactly)

**Intents:** `general` · `shipping_delay` · `refund_request` · `question` · `account_billing` · **`off_topic`**

**Moods:** `neutral` · `angry` · `confused` · `happy`

**Matrix:** 6 × 4 = **24** templates for full coverage.

**Fallback order** (if a cell is missing): for most intents, exact pair → `general` + same mood → same intent + `neutral` → `general` + `neutral`. For **`off_topic`**, the app avoids `general` + the same non-neutral mood first (so a “happy thanks” template is not used for CNN-style mail); see `findTemplateWithFallback` in `templatesRepo.ts`.

**`off_topic` + `{{order_summary}}`:** The processor **replaces** `{{order_summary}}` with a fixed boundary line (no CachedOrder rows) so unrelated requests do not receive order history.

---

## 3. Variables (filled by the app, not by the model)

These keys are substituted by `renderTemplate` in `src/lib/templates/simpleRenderer.ts` using the `context` built in `src/lib/gmail/emailProcessor.ts`. For **HTML** templates (`isHtml`), string values are passed through `escapeTemplateContextForHtml` so inbound-derived text cannot break out of the layout.


| Variable             | Meaning                                                                               |
| -------------------- | ------------------------------------------------------------------------------------- |
| `{{customer_name}}`  | Greeting name from sender email local-part (title-cased, e.g. `Cloudtalat`)           |
| `{{customer_email}}` | Sender email address                                                                  |
| `{{store_name}}`     | `Store.businessName`                                                                  |
| `{{store_email}}`    | `Store.email`                                                                         |
| `{{subject}}`        | Incoming subject line                                                                 |
| `{{ticket_summary}}` | Short summary (Groq classification `short_summary` or message excerpt)                |
| `{{order_summary}}`  | See **Order summary routing** below                                                    |


**Order summary routing (`{{order_summary}}`):**

- **Cached rows:** Plain-text lines from **CachedOrder** when the pipeline loads order context (sender email matches; order-number hints, when present, are taken from the message after quoted-reply stripping).
- **`off_topic`:** Fixed boundary line (no order rows).
- **Counter-question:** If the message looks like shipping / refund / billing (including via intent **or** keyword heuristic) and **no** order number was detected, a fixed line asks the customer to send an order number — **no** cache lookup.
- **Hint mismatch:** If the customer named an order number that does **not** match their cached orders for that email, a fixed clarification line is used — **other** orders are **not** substituted.
- **Low confidence:** If Groq returns `general` or `question` with confidence below `GMAIL_CLASSIFY_CONFIDENCE_MIN` (default `0.5`) and there are no hints, a conservative line is used instead of cache.
- **Sparse body:** Very short messages without hints use a fixed “please add detail” line instead of cache.
- **`question` intent, no hints:** Order history is omitted; a short line explains that replies without attaching order rows unless they send an order number.
- **No cache match (otherwise):** Fallback sentence; if the topic looks order-related, copy may mention trying another checkout email.

Do **not** hardcode customer names or order numbers in the body (example numbers like `#1002` in **instructions** to the customer are OK).

---

## 4. How to add manually

1. Open **Dashboard → JUNO Engine → Email templates**.
2. Create **New template** (or duplicate).
3. Set **Intent** and **Mood** to the values in each section (exact strings).
4. Paste **Body** HTML.
5. Set **HTML** / `isHtml` = on.
6. Save.

Repeat for all **20** sections (or start with **neutral** only — five templates — and add moods later).

---

## 5. Templates (copy body only; set name / intent / mood as shown)

### 5.1 `general` + `neutral`


| Field           | Value                             |
| --------------- | --------------------------------- |
| **name**        | General — Neutral                 |
| **intent**      | `general`                         |
| **mood**        | `neutral`                         |
| **description** | Catch-all polite acknowledgement. |


**body:**

```html
<div>Hello {{customer_name}},</div>
<div>Thank you for contacting {{store_name}}.</div>
<div><strong>Regarding your message:</strong> {{ticket_summary}}</div>
<div><strong>What we have on file for {{customer_email}}:</strong><br/>{{order_summary}}</div>
<div>If you need anything else, reply to this email or write to us at {{store_email}}.</div>
<div>Best regards,<br/>{{store_name}} Support</div>
```

---

### 5.2 `general` + `angry`


| Field           | Value                                       |
| --------------- | ------------------------------------------- |
| **name**        | General — Angry                             |
| **intent**      | `general`                                   |
| **mood**        | `angry`                                     |
| **description** | Acknowledge frustration; stay professional. |


**body:**

```html
<div>Hello {{customer_name}},</div>
<div>We’re sorry you’ve had a frustrating experience. Thank you for letting us know.</div>
<div><strong>Your message:</strong> {{ticket_summary}}</div>
<div><strong>Our records for your email:</strong><br/>{{order_summary}}</div>
<div>We’ll take this seriously. Please reply here or contact {{store_email}} so we can help.</div>
<div>Best regards,<br/>{{store_name}} Support</div>
```

---

### 5.3 `general` + `confused`


| Field           | Value                      |
| --------------- | -------------------------- |
| **name**        | General — Confused         |
| **intent**      | `general`                  |
| **mood**        | `confused`                 |
| **description** | Clarify next steps simply. |


**body:**

```html
<div>Hello {{customer_name}},</div>
<div>Thanks for reaching out to {{store_name}}. We’re happy to clear things up.</div>
<div><strong>What we understood:</strong> {{ticket_summary}}</div>
<div><strong>What we show on file for {{customer_email}}:</strong><br/>{{order_summary}}</div>
<div>If something doesn’t match what you expected, reply with any extra details (order number, screenshots) and we’ll review.</div>
<div>Best regards,<br/>{{store_name}} Support</div>
```

---

### 5.4 `general` + `happy`


| Field           | Value           |
| --------------- | --------------- |
| **name**        | General — Happy |
| **intent**      | `general`       |
| **mood**        | `happy`         |
| **description** | Warm, brief.    |


**body:**

```html
<div>Hello {{customer_name}},</div>
<div>Thank you for the kind message — we really appreciate it.</div>
<div><strong>Summary:</strong> {{ticket_summary}}</div>
<div><strong>On file:</strong><br/>{{order_summary}}</div>
<div>We’re here if you need anything else at {{store_email}}.</div>
<div>Best regards,<br/>{{store_name}} Support</div>
```

---

### 5.5 `shipping_delay` + `neutral`


| Field           | Value                                            |
| --------------- | ------------------------------------------------ |
| **name**        | Shipping — Neutral                               |
| **intent**      | `shipping_delay`                                 |
| **mood**        | `neutral`                                        |
| **description** | Order / shipping status using cached facts only. |


**body:**

```html
<div>Hello {{customer_name}},</div>
<div>Thank you for contacting {{store_name}} about your shipment.</div>
<div><strong>Your question:</strong> {{ticket_summary}}</div>
<div><strong>Order details we have on file:</strong><br/>{{order_summary}}</div>
<div>Reply to this thread if you need more detail, or email {{store_email}}.</div>
<div>Best regards,<br/>{{store_name}} Support</div>
```

---

### 5.6 `shipping_delay` + `angry`


| Field           | Value                       |
| --------------- | --------------------------- |
| **name**        | Shipping — Angry            |
| **intent**      | `shipping_delay`            |
| **mood**        | `angry`                     |
| **description** | Empathy + facts from cache. |


**body:**

```html
<div>Hello {{customer_name}},</div>
<div>We’re sorry for the stress this has caused. We want to get you a clear answer.</div>
<div><strong>What you told us:</strong> {{ticket_summary}}</div>
<div><strong>What our system shows for {{customer_email}}:</strong><br/>{{order_summary}}</div>
<div>If anything looks wrong, reply with your order number and we’ll escalate.</div>
<div>Best regards,<br/>{{store_name}} Support</div>
```

---

### 5.7 `shipping_delay` + `confused`


| Field           | Value               |
| --------------- | ------------------- |
| **name**        | Shipping — Confused |
| **intent**      | `shipping_delay`    |
| **mood**        | `confused`          |
| **description** | Step-by-step tone.  |


**body:**

```html
<div>Hello {{customer_name}},</div>
<div>Thanks for writing to {{store_name}}. Here’s what we can confirm from our records.</div>
<div><strong>Your message:</strong> {{ticket_summary}}</div>
<div><strong>Shipment / order info on file:</strong><br/>{{order_summary}}</div>
<div>If the status doesn’t match what you see, tell us the order number in your reply and we’ll investigate.</div>
<div>Best regards,<br/>{{store_name}} Support</div>
```

---

### 5.8 `shipping_delay` + `happy`


| Field           | Value              |
| --------------- | ------------------ |
| **name**        | Shipping — Happy   |
| **intent**      | `shipping_delay`   |
| **mood**        | `happy`            |
| **description** | Friendly check-in. |


**body:**

```html
<div>Hello {{customer_name}},</div>
<div>Thanks for checking in with {{store_name}}.</div>
<div><strong>Note:</strong> {{ticket_summary}}</div>
<div><strong>Your order snapshot:</strong><br/>{{order_summary}}</div>
<div>Reach us anytime at {{store_email}}.</div>
<div>Best regards,<br/>{{store_name}} Support</div>
```

---

### 5.9 `refund_request` + `neutral`


| Field           | Value                                   |
| --------------- | --------------------------------------- |
| **name**        | Refund — Neutral                        |
| **intent**      | `refund_request`                        |
| **mood**        | `neutral`                               |
| **description** | Refund / return path; facts from cache. |


**body:**

```html
<div>Hello {{customer_name}},</div>
<div>Thank you for contacting {{store_name}} about a refund or return.</div>
<div><strong>Request summary:</strong> {{ticket_summary}}</div>
<div><strong>Related order info on file:</strong><br/>{{order_summary}}</div>
<div>Our team will review against store policy. For follow-up, reply here or use {{store_email}}.</div>
<div>Best regards,<br/>{{store_name}} Support</div>
```

---

### 5.10 `refund_request` + `angry`


| Field           | Value                                          |
| --------------- | ---------------------------------------------- |
| **name**        | Refund — Angry                                 |
| **intent**      | `refund_request`                               |
| **mood**        | `angry`                                        |
| **description** | Acknowledge anger; no promises outside policy. |


**body:**

```html
<div>Hello {{customer_name}},</div>
<div>We’re sorry this situation has upset you. We take refund and return requests seriously.</div>
<div><strong>What you raised:</strong> {{ticket_summary}}</div>
<div><strong>Order details on file:</strong><br/>{{order_summary}}</div>
<div>We’ll review and respond with next steps. You can also email {{store_email}}.</div>
<div>Best regards,<br/>{{store_name}} Support</div>
```

---

### 5.11 `refund_request` + `confused`


| Field           | Value                            |
| --------------- | -------------------------------- |
| **name**        | Refund — Confused                |
| **intent**      | `refund_request`                 |
| **mood**        | `confused`                       |
| **description** | Clarify what you need from them. |


**body:**

```html
<div>Hello {{customer_name}},</div>
<div>Thanks for reaching out to {{store_name}}. We want to handle your refund or return request correctly.</div>
<div><strong>What we understood:</strong> {{ticket_summary}}</div>
<div><strong>Order context:</strong><br/>{{order_summary}}</div>
<div>If you can confirm the order number and reason in your reply, that helps us move faster.</div>
<div>Best regards,<br/>{{store_name}} Support</div>
```

---

### 5.12 `refund_request` + `happy`


| Field           | Value             |
| --------------- | ----------------- |
| **name**        | Refund — Happy    |
| **intent**      | `refund_request`  |
| **mood**        | `happy`           |
| **description** | Cooperative tone. |


**body:**

```html
<div>Hello {{customer_name}},</div>
<div>Thank you for contacting {{store_name}} — we’ll help with your refund or return.</div>
<div><strong>Summary:</strong> {{ticket_summary}}</div>
<div><strong>On file:</strong><br/>{{order_summary}}</div>
<div>We’ll follow up shortly. Questions? {{store_email}}</div>
<div>Best regards,<br/>{{store_name}} Support</div>
```

---

### 5.13 `question` + `neutral`


| Field           | Value                               |
| --------------- | ----------------------------------- |
| **name**        | Product / policy question — Neutral |
| **intent**      | `question`                          |
| **mood**        | `neutral`                           |
| **description** | Product or how-to questions.        |


**body:**

```html
<div>Hello {{customer_name}},</div>
<div>Thank you for your question to {{store_name}}.</div>
<div><strong>Topic:</strong> {{ticket_summary}}</div>
<div><strong>Your email subject:</strong> {{subject}}</div>
<div><strong>Order info on file (if any):</strong><br/>{{order_summary}}</div>
<div>For more detail, reply to this message or write to {{store_email}}.</div>
<div>Best regards,<br/>{{store_name}} Support</div>
```

---

### 5.14 `question` + `angry`


| Field           | Value                             |
| --------------- | --------------------------------- |
| **name**        | Product / policy question — Angry |
| **intent**      | `question`                        |
| **mood**        | `angry`                           |
| **description** | De-escalate while answering.      |


**body:**

```html
<div>Hello {{customer_name}},</div>
<div>We’re sorry you’re having a rough experience. We’re here to help with your question.</div>
<div><strong>What you asked:</strong> {{ticket_summary}}</div>
<div><strong>Relevant order info:</strong><br/>{{order_summary}}</div>
<div>We’ll review and reply with specifics. Contact: {{store_email}}</div>
<div>Best regards,<br/>{{store_name}} Support</div>
```

---

### 5.15 `question` + `confused`


| Field           | Value                                |
| --------------- | ------------------------------------ |
| **name**        | Product / policy question — Confused |
| **intent**      | `question`                           |
| **mood**        | `confused`                           |
| **description** | Simple, structured.                  |


**body:**

```html
<div>Hello {{customer_name}},</div>
<div>Thanks for writing to {{store_name}}. Here’s a quick reply based on what you sent.</div>
<div><strong>Your message:</strong> {{ticket_summary}}</div>
<div><strong>Order snapshot (if applicable):</strong><br/>{{order_summary}}</div>
<div>If we missed something, reply with a bit more detail and we’ll clarify.</div>
<div>Best regards,<br/>{{store_name}} Support</div>
```

---

### 5.16 `question` + `happy`


| Field           | Value                             |
| --------------- | --------------------------------- |
| **name**        | Product / policy question — Happy |
| **intent**      | `question`                        |
| **mood**        | `happy`                           |
| **description** | Upbeat, helpful.                  |


**body:**

```html
<div>Hello {{customer_name}},</div>
<div>Thanks for reaching out — we love helping customers.</div>
<div><strong>Your question:</strong> {{ticket_summary}}</div>
<div><strong>On file:</strong><br/>{{order_summary}}</div>
<div>Anything else, just reply or email {{store_email}}.</div>
<div>Best regards,<br/>{{store_name}} Support</div>
```

---

### 5.17 `account_billing` + `neutral`


| Field           | Value                              |
| --------------- | ---------------------------------- |
| **name**        | Billing — Neutral                  |
| **intent**      | `account_billing`                  |
| **mood**        | `neutral`                          |
| **description** | Charges, invoices, payment issues. |


**body:**

```html
<div>Hello {{customer_name}},</div>
<div>Thank you for contacting {{store_name}} about billing or your account.</div>
<div><strong>Issue summary:</strong> {{ticket_summary}}</div>
<div><strong>Order / payment-related info on file:</strong><br/>{{order_summary}}</div>
<div>Our team will review. For sensitive details, we may ask you to confirm via {{store_email}}.</div>
<div>Best regards,<br/>{{store_name}} Support</div>
```

---

### 5.18 `account_billing` + `angry`


| Field           | Value               |
| --------------- | ------------------- |
| **name**        | Billing — Angry     |
| **intent**      | `account_billing`   |
| **mood**        | `angry`             |
| **description** | Serious, calm tone. |


**body:**

```html
<div>Hello {{customer_name}},</div>
<div>We’re sorry for the concern about charges or your account. We’ll look into this carefully.</div>
<div><strong>What you reported:</strong> {{ticket_summary}}</div>
<div><strong>Related order info:</strong><br/>{{order_summary}}</div>
<div>We may follow up from {{store_email}} with next steps.</div>
<div>Best regards,<br/>{{store_name}} Support</div>
```

---

### 5.19 `account_billing` + `confused`


| Field           | Value                       |
| --------------- | --------------------------- |
| **name**        | Billing — Confused          |
| **intent**      | `account_billing`           |
| **mood**        | `confused`                  |
| **description** | Ask for specifics politely. |


**body:**

```html
<div>Hello {{customer_name}},</div>
<div>Thanks for writing to {{store_name}} about billing.</div>
<div><strong>What we understood:</strong> {{ticket_summary}}</div>
<div><strong>What we see on file for {{customer_email}}:</strong><br/>{{order_summary}}</div>
<div>If you can share the charge date or last four digits (never full card in email), that speeds things up.</div>
<div>Best regards,<br/>{{store_name}} Support</div>
```

---

### 5.20 `account_billing` + `happy`


| Field           | Value                     |
| --------------- | ------------------------- |
| **name**        | Billing — Happy           |
| **intent**      | `account_billing`         |
| **mood**        | `happy`                   |
| **description** | Cooperative billing help. |


**body:**

```html
<div>Hello {{customer_name}},</div>
<div>Thanks for getting in touch about your account or billing.</div>
<div><strong>Summary:</strong> {{ticket_summary}}</div>
<div><strong>Records:</strong><br/>{{order_summary}}</div>
<div>We’ll help sort this out — reach us at {{store_email}} if needed.</div>
<div>Best regards,<br/>{{store_name}} Support</div>
```

---

### 5.21–5.24 `off_topic` (news, weather, unrelated)

Use **`intent`: `off_topic`**. Bodies should state that only store-related topics are handled. **`{{order_summary}}`** is still substituted but the runtime uses a **non-sensitive boundary string**, not real orders.

**5.21 `off_topic` + `neutral` (recommended minimum)**

| Field | Value |
|--------|--------|
| **name** | Off-topic — Neutral |
| **intent** | `off_topic` |
| **mood** | `neutral` |

**body:**

```html
<div>Hello {{customer_name}},</div>
<div>Thanks for writing to {{store_name}}.</div>
<div>This inbox only helps with orders, products, shipping, returns, and billing. We can’t answer unrelated topics (news, weather, other sites, or general chat).</div>
<div>{{order_summary}}</div>
<div>For store help, reply with your question and order number if you have one, or email {{store_email}}.</div>
<div>Best regards,<br/>{{store_name}} Support</div>
```

Repeat for **angry / confused / happy** with the same structure and a one-line empathy or tone tweak if you want full mood coverage (same pattern as other intents).

---

## 6. Optional `variables` JSON (per template)

You can paste this into **variables** metadata in the UI if your editor supports it, or leave empty:

```json
{
  "seed": "gmail-templates-catalog",
  "keys": [
    "customer_name",
    "customer_email",
    "store_name",
    "store_email",
    "subject",
    "ticket_summary",
    "order_summary"
  ]
}
```

---

## 7. Reminder: routing in code

- **Intent/mood:** Groq classifies the incoming message (`classifyCustomerEmail` in `src/lib/ai/gmailGroq.ts`). Returns `source: "groq" \| "fallback"` when the API or JSON parse fails (defaults to `general` + `neutral`).  
- **Sensitive-topic heuristic:** `looksLikeSensitiveOrderTopic` in `src/lib/ai/gmailOrderDisclosure.ts` aligns disclosure with shipping/refund/billing wording when the classifier misses.  
- **Hints:** `stripQuotedEmailTrailForHints` + `extractOrderNumberHints` in `src/lib/ai/gmailContext.ts` reduce false hints from quoted threads.  
- **Reply body:** `processIncomingEmail` calls `generateAutoReplyPreview` (`src/lib/gmail/autoReplyPreview.ts`): L1 orchestrator when guardrails allow, else built-in fallback HTML. Vendor-editable DB templates and `generateReplyAndTemplateFields` were removed.  
- **Order context:** `buildOrderSummaryForEmail` reads **CachedOrder** only; keep cache in sync with Shopify.  
- **Fallback HTML:** `buildOffTopicFallbackHtml`, `buildNeedOrderIdFallbackHtml`, `buildHintUnmatchedFallbackHtml`, or `buildMinimalFallbackHtml` when L1 is skipped or returns empty.  
- **Abuse / idempotency:** Per-sender caps via `EmailLog` (`checkGmailAutoReplyGuards`); duplicate inbound Gmail `message` ids use `GmailInboundAutoReply` so the same message is not auto-replied twice. Env: `GMAIL_AUTO_REPLY_MAX_PER_SENDER_PER_HOUR` (default 15), `GMAIL_AUTO_REPLY_BURST_MAX_PER_10MIN` (default 6); set to `0` to disable that cap.

---

*Historical doc: intents/moods still align with `src/lib/ai/gmailTaxonomy.ts`. The `Template` table may exist in older DBs but is no longer used by the Gmail reply path.*