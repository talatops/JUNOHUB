# Gmail auto-reply — manual test scenarios

Use this checklist to send **real emails** into your connected Gmail inbox (from an address that matches your test customer / `CachedOrder` email when you expect order rows). Trigger processing via **webhook** or **poll** as you normally do.

**Prerequisites**

- Dashboard store is **active**; Gmail integration connected for the user processing mail.
- Sender is **`@gmail.com`** (non-Gmail senders are skipped by the processor).
- Saved **email templates** exist for the intent/mood pairs you expect (or you will see **fallback HTML**).
- **`CachedOrder`** has rows for your test sender email when you expect real order lines in `{{order_summary}}`.
- **Groq** is available for classification unless you are explicitly testing fallback (`source: fallback` in logs). Intent labels can vary slightly per model run; the **sensitive-topic heuristic** covers many “where’s my package?” cases even if intent is `general`.

**How to verify**

- Read the **auto-reply body**: check whether it **names a specific order, date, and total** from cache vs. **fixed policy text** asking for an order number or explaining a boundary.
- Optional: check app logs for flags like `needsOrderNumberFirst`, `hintUnmatched`, `classifySource`, `messageTooSparse`.

Replace placeholders:

- `YOUR_STORE` — business name from the active store.
- `YOU@gmail.com` — the inbox that receives mail (merchant).
- `CUSTOMER@gmail.com` — sender that matches `CachedOrder.email` (or customer JSON email) when testing cache hits.

---

## 1. Counter-question (no order number, shipping-style message)

**Goal:** No CachedOrder rows should appear in the reply; customer is asked to send an order number.

| Field | Example |
| ----- | ------- |
| **From** | `CUSTOMER@gmail.com` (must match cache email if you want to prove orders exist but are hidden) |
| **Subject** | `Where is my package?` |
| **Body** | `Hi, I still haven't received anything. Can you check the status for me? Thanks.` |

**Expected**

- **`{{order_summary}}`** resolves to text like: *no order details shown yet* / *did not see an order number* / *reply with your order number (e.g. #1002)* — **not** real order lines for #1002 or any order.
- **Template:** `shipping_delay` or `general` mood depending on Groq; if no template, **need-order-id fallback HTML** (`buildNeedOrderIdFallbackHtml`).
- **Log:** `needsOrderNumberFirst: true` (from intent `shipping_delay` / `refund_request` / `account_billing` **or** `looksLikeSensitiveOrderTopic` on subject+body).

---

## 2. Counter-question (explicit refund language, no order #)

| Field | Example |
| ----- | ------- |
| **Subject** | `Refund` |
| **Body** | `I need a refund on my last purchase. Please process it.` |

**Expected**

- Same as §1: **no** order block from cache without an order hint; counter-question / policy line only.
- Often classified `refund_request`; heuristic also matches **refund**.

---

## 3. Counter-question (billing language, no order #)

| Field | Example |
| ----- | ------- |
| **Subject** | `Wrong charge` |
| **Body** | `I see a duplicate charge on my card for your store. Please fix it.` |

**Expected**

- No order summary from cache until an order number appears; counter-style line.
- Heuristic may match **wrong charge** / **billing**.

---

## 4. Order context shown (single clear order hint)

**Precondition:** `CachedOrder` includes order **#1002** (or `#1003`) for `CUSTOMER@gmail.com`.

| Field | Example |
| ----- | ------- |
| **Subject** | `Order status` |
| **Body** | `Hi, can you confirm status for order #1002? Thanks.` |

**Expected**

- **`{{order_summary}}`** contains **real** lines for order **1002** (date, financial/fulfillment, total, items) from cache.
- **Log:** `orderHints` includes `1002`, `needsOrderNumberFirst: false`, `hintUnmatched: false`.

---

## 5. Order context shown (hint in subject only)

| Field | Example |
| ----- | ------- |
| **Subject** | `Re: #1002 shipping` |
| **Body** | `When will it ship?` |

**Expected**

- Hints extracted from subject+body → **1002**; summary prefers matching order if present in cache.

---

## 6. Hint mismatch (order # not on file for this email)

**Precondition:** Cache has orders for `CUSTOMER@gmail.com` but **not** `#9999**.

| Field | Example |
| ----- | ------- |
| **Subject** | `Order 9999` |
| **Body** | `I need help with order #9999.` |

**Expected**

- **No** substitution of unrelated orders (e.g. not “here is #1002” instead).
- **`{{order_summary}}`** uses **hint-unmatched** copy: cannot match order number(s) to orders on file under this email; ask to double-check / confirm checkout email.
- **Log:** `hintUnmatched: true`.
- If no template: **hint-unmatched fallback HTML**.

---

## 7. Multiple order numbers, not all match cache

**Precondition:** Cache has **1002** but not **8888**.

| Field | Example |
| ----- | ------- |
| **Body** | `Please check orders #1002 and #8888.` |

**Expected**

- **hintUnmatched** path (ambiguous / not all hints resolved); **no** listing of 1002 as if everything were OK unless you change code — current behavior withholds mismatched multi-hint summaries.

---

## 8. Off-topic (no store-related request)

| Field | Example |
| ----- | ------- |
| **Subject** | `Weather tomorrow` |
| **Body** | `What is the weather in Paris tomorrow?` |

**Expected**

- Intent **`off_topic`** (typical with Groq).
- **`{{order_summary}}`** = fixed **boundary** line (no CachedOrder data).
- **Template:** `off_topic` + mood, or **off-topic fallback HTML**.

---

## 9. Product / policy question without order number

| Field | Example |
| ----- | ------- |
| **Subject** | `Sizing question` |
| **Body** | `Does the medium hoodie run true to size?` |

**Expected**

- Intent **`question`** (typical).
- **`{{order_summary}}`** = line that **omits order history** (*replying without attaching order history* / send order # if about a purchase).
- **Log:** `skipOrderCacheForQuestion` effectively via `question` + no hints.

---

## 10. General thank-you (no shipping/refund/billing wording)

| Field | Example |
| ----- | ------- |
| **Subject** | `Thanks` |
| **Body** | `Thank you so much for the fast delivery and great product!` |

**Expected**

- Intent **`general`**, **`happy`** possible.
- **No** sensitive heuristic → **with** cache for sender, **`{{order_summary}}`** may show **up to 3 recent orders** (normal path).
- If you need thanks to **never** show orders, that would require a separate product rule (not implemented).

---

## 11. Very short body (sparse message)

| Field | Example |
| ----- | ------- |
| **Subject** | `Hi` |
| **Body** | `Help` |

**Expected**

- `plainForAi.trim().length < 12` → **messageTooSparse**.
- Fixed **`ticket_summary`** about not enough text to look up an order; **`{{order_summary}}`** = **sparse** line (ask for a sentence or two + order # if about an order).
- **No** cache load for order block.

---

## 12. Low confidence (general / question only)

**Precondition:** Groq returns valid JSON with **`confidence` &lt; `GMAIL_CLASSIFY_CONFIDENCE_MIN`** (default **0.5**) and intent **`general`** or **`question`**, no order hints.

**How to test**

- Hard to force manually; watch logs for `lowConfidenceSuppressOrders: true` if the model returns low confidence.
- **Expected:** **`{{order_summary}}`** = *not fully confident how to categorize* / ask for order number if about an order; **no** cache rows for that branch.

---

## 13. Quoted thread with stale order # in reply chain

| Field | Example |
| ----- | ------- |
| **Body** | `Still waiting on my new order.\n\nOn Mon, Jan 1, 2026 at 9:00 AM wrote:\n> Order #9999 from old ticket` |

**Precondition:** You only care about **new** content; hints should prefer **strip quoted** portion.

**Expected**

- Hints extracted **after** `stripQuotedEmailTrailForHints` — **#9999** often **dropped** if the quote block is removed; if no hint remains and the visible line is shipping-like, **counter-question** behavior applies.

*(Exact hint list depends on where the regex cuts; this scenario validates quote stripping.)*

---

## 14. Groq unavailable / bad JSON (classification fallback)

**How to test**

- Temporarily break **`GROQ_API_KEY`** or block Groq; or rely on parse failure (rare).

**Expected**

- `classifySource: **fallback**` → `general` + `neutral` by default.
- If the message still matches **sensitive heuristic** (e.g. “where is my package”) **without** hints → **needsOrderNumberFirst** still true → **no** accidental order dump.

---

## 15. No CachedOrder for sender (guest / wrong email)

| Field | Example |
| ----- | ------- |
| **From** | `other.person@gmail.com` (no rows in `CachedOrder` for this email) |
| **Subject** | `Order help` |
| **Body** | `I placed an order last week, can you find it?` |

**Expected**

- If **needsOrderNumberFirst** or counter path: policy text only.
- If cache allowed but empty: **`noOrdersFallback`** — generic *no matching orders*; if **sensitiveTopic**, extra line about **different email at checkout**.

---

## 16. Safety / abuse screen (no auto-reply)

| Field | Example |
| ----- | ------- |
| **Body** | Content that triggers **`screenInboundEmailForAbuse`** (per `gmailSafety.ts` rules). |

**Expected**

- **No** customer reply email sent.
- Email may be stored as **flagged**; marked read per implementation.
- **Log:** inbound flagged, no auto-reply.

*(Use only in a test account; do not send real harmful content from production customers.)*

---

## 17. Duplicate inbound message (idempotency)

**How to test**

- Process the same Gmail **message id** twice (e.g. replay webhook or race poll + webhook).

**Expected**

- Second run: **no second auto-reply**; `GmailInboundAutoReply` unique constraint; log *duplicate / skip*.
- Message may still be marked read.

---

## 18. Per-sender rate limit

**Precondition:** Default caps — **15** auto-replies / hour and **6** / 10 minutes per `storeId` + recipient (`EmailLog` with triggers `GMAIL_WEBHOOK` / `GMAIL_POLL`).

**How to test**

- Send many distinct threads from the same `CUSTOMER@gmail.com` quickly until cap hits.

**Expected**

- Further auto-replies **suppressed** for that sender; log **rate limited**; **no** lease consumed for skipped path (lease is acquired after rate check — verify in code: rate check is **before** lease).

---

## 19. Non-Gmail sender skipped

| Field | Example |
| ----- | ------- |
| **From** | `customer@company.com` |

**Expected**

- Processor returns early; **no** auto-reply from this pipeline (by design in `emailProcessor.ts`).

---

## 20. HTML escaping (security smoke test)

| Field | Example |
| ----- | ------- |
| **Body** | `Question: <script>alert(1)</script> and order #1002` |

**Expected**

- Reply is HTML email; **script should not execute** in clients; template variables for HTML templates go through **`escapeTemplateContextForHtml`** — angle brackets in **`ticket_summary`** / snippets should appear **escaped** in source, not as raw tags.

---

## Quick matrix

| # | Scenario | Order # in email? | Expect real order lines in reply? |
|---|----------|-------------------|-----------------------------------|
| 1–3 | Counter / sensitive, no hint | No | **No** |
| 4–5 | Clear hint matching cache | Yes | **Yes** (matching order(s)) |
| 6–7 | Hint not matching / partial multi-hint | Yes (bad mix) | **No** (policy / unmatched copy) |
| 8 | Off-topic | — | **No** |
| 9 | Question, no hint | No | **No** (question-specific line) |
| 10 | General thanks | No | **Yes** if cache exists (by design) |
| 11 | Sparse body | No | **No** |
| 12 | Low confidence g/q | No | **No** |
| 15 | No cache row | — | **No** (fallback copy) |

---

## Environment variables (optional tuning)

| Variable | Default | Effect |
| -------- | ------- | ------ |
| `GMAIL_CLASSIFY_CONFIDENCE_MIN` | `0.5` | Below this, suppress cache for `general` / `question` without hints. |
| `GMAIL_AUTO_REPLY_MAX_PER_SENDER_PER_HOUR` | `15` | Max automated Gmail replies per hour per store + recipient. |
| `GMAIL_AUTO_REPLY_BURST_MAX_PER_10MIN` | `6` | Burst cap per 10 minutes. Set to `0` to disable that check’s enforcement (see `gmailAutoReplyGuards.ts`). |

---

*Aligned with `src/lib/gmail/emailProcessor.ts`, `gmailContext.ts`, `gmailOrderDisclosure.ts`, `gmailGroq.ts`, and `docs/gmail-templates-catalog.md`.*
