# Vendor use-case knowledge modules & L1 agentic implementation plan

**Read this first (integration).** This file is an **implementation-oriented plan** meant to be **merged into an existing codebase** (Shopify sync, dashboard, DB already in place). **You are not required to follow** the **module codes**, **`shared_field_id`** strings, **table/column names**, **tool names**, **flags**, **slot keys**, or any other **rigid-looking** labels in this document when they would **create conflict** with your current schema, migrations, types, or APIs. Those conventions exist **only** to keep the spec **internally consistent** and to explain **how** the system should behave. **Map concepts, not strings:** keep the **ideas** (which flows are L1 vs ticket vs KB, verification rules, prerequisites, tool-call *shape*); **rename and wire** to whatever your project already uses. If spec and repo disagree on names, **default to the repo** unless you explicitly refactor.

> **Same caution, shorter:** Identifiers in this doc are **illustrative**, not a mandate. **Codebase wins** over literal tags here. Preserve **behavior and structure**, not every ID.

**Purpose.** This document defines **shortlisted customer-support use-cases** as **optional sub-modules**: vendor **knowledge (FAQ-style)**, **L1 transactional automation** (read/act on data you already sync from Shopify into your database), and **ticketing** (human resolution). It also specifies **two customer interfaces** (email + storefront widget), **verification** (email + OTP only), and **constraints** so implementations stay consistent.

**Scope (agentic layer only).** Shopify store, vendor dashboard, and **database hydration from Shopify** are **assumed to exist**. This plan covers the **L1 automation layer** (intent handling, retrieval, slot filling, verification, safe responses, ticket creation). It does **not** describe full end-to-end replacement of human support.

**Data access (tool calls).** The agent does **not** “know” order lines, inventory, tracking, or **category metadetails** by default. Implementation must expose **tool calls** (or equivalent server-side functions) that **query your database** using your **actual schema** and **field names** for each store. Answers for **transactional** flows and for **catalog metadata** flows are only as good as (a) what is synced into the DB and (b) which tools the orchestrator is allowed to invoke for that module. Document concrete tool names, parameters, and return shapes in engineering specs **for your real schema** — those names **need not** match any examples elsewhere in this document (see **Read this first** above).

**Excluded use-cases** (out of scope for this framework):

- Subscription / repeat orders  
- Wholesale / B2B / large orders  
- Account & security (e.g. Shopify permission / identity beyond email+OTP)  
- VIP / loyalty context  
- **Shopify customer login** and **magic-link** verification (explicitly not used)  

---

## 0. What we automate vs what humans do

### 0.1 L1 only — not the whole pipeline

- **L1** = deflection and **safe, bounded** automation: answer from **knowledge**, **read** order/product state from your DB, perform **allowed** actions (e.g. cancel when rules say yes), and **hand off** when the job requires judgment, negotiation, or operational access beyond the playbook.
- **Tickets** = default path when the use-case is **human work** (order change, warranty processing, payment disputes, complaint resolution, return/exchange **handling**, etc.). There is **no generic end-to-end workflow** for tickets in the agentic sense: a **real human** owns the ticket. The agent may **draft context** for the human (summary, slots filled, policy snippets), but **resolution is human**.

### 0.2 Three pillars (every module maps to one primary pillar)

| Pillar | Meaning | Typical outputs |
|--------|---------|-----------------|
| **Knowledge (FAQ)** | Answers from vendor-configured text + embeddings / RAG; **no** order mutation; may not need identity. | Policy explanations, links, “how we work.” |
| **Transactional L1** | Uses **verified identity** + **prerequisites** (e.g. order id); **reads** DB (and optionally **acts** where allowed). | Order status, tracking snapshot, cancel eligibility + cancel, refund **status** lookup, inventory lookup. |
| **Ticket-led** | After verification (when needed), **create or continue a ticket**; customer-facing reply is acknowledgement + expectations; **human** executes. | Order change, warranty, payment disputes, wrong-item resolution, return/exchange **initiation**, complaints, many shipment exceptions. |
| **Catalog metadata (DB-backed)** | Answers grounded in **structured fields** synced from the storefront (e.g. **category metadetails**), retrieved via **tool calls** — not free-form vendor FAQ text for those facts. | Category-wide sizing notes, materials, care, compatibility text the merchant attached at **category** level; applies to **all products** in that category. |

**Note:** “Refund **policy**” (e.g. “how long do refunds take?”) is **Knowledge**. “**Refund status** for my order” is **Transactional** (needs identification + order/return context in DB).

**Category metadetails module (vendor toggle).** Merchants can maintain **details at the category level** in Shopify (and equivalents); once synced to your DB, that data can power answers (e.g. fit, fabric, voltage) **across every product in those categories**. In the product, the vendor has a **single switch**: **enable** or **disable** use of category metadetails for automation — **no per-category granularity** in v1. When **disabled**, the agent must **not** use tool calls that return category metadetails (fall back to KB, PDP links, or ticket). When **enabled**, the agent may answer from **metadetails of all categories/products** the store has synced, subject to intent and **tool-call** availability.

### 0.3 Tickets and email

- Tickets are **internal** objects; **conversation with the customer** for ticket-heavy flows is still primarily **email** (and mirrored logic on the widget where applicable).
- If the customer is **already on email**, opening a ticket (e.g. return initiation, complaint) can be **initiated automatically** from that thread once rules are satisfied.
- If the customer is on the **widget**, they complete **email + OTP + session** first; then “open a ticket” creates the ticket and **subsequent human↔customer** dialogue happens over **email** (or the same channels you define in `sf_support_channels`).

---

## 1. Customer interfaces

### 1.1 Email

- **Identity signal:** the **sender address** (`From:`) is the customer email for that thread.
- **Strict rule (transactional):** for any **fiber** / sensitive action (order status, cancel, refund status, shipping details tied to an order, etc.), the **only** email identity you trust for lookup is **`From` matches the email on the order / customer record** in your database. The customer **cannot** ask for someone else’s order from their own inbox; they must **send from the email that placed the order** (e.g. they cannot use their personal Gmail to query a friend’s order placed under the friend’s email).
- **Verification path on email:** **no OTP** in v1 of this plan for email (optional future); trust is **email alignment** with DB. If `From` is not associated with any customer/order, respond with a **generic** safe message (do not confirm whether an order exists for another email) and instruct them to contact support from the **email used at checkout**.
- **Multi-order disambiguation:** if `From` matches a customer with **multiple open or recent orders**, L1 **lists** candidate orders (e.g. id, date, short descriptor) and asks **which order** they mean before fetching full details or acting.

### 1.2 Storefront widget (chat)

- **Unauthenticated path:** if the user only needs **Knowledge (FAQ)** and the vendor has enabled that module, answer using RAG/KB **without** collecting email (no session required for pure FAQ).
- **Transactional path:** to run any **Transactional L1** or **Ticket-led** flow that depends on **who** the customer is:
  1. Collect **email address** (the one they assert is their order email).
  2. Start a **server-side session** bound to that email attempt; show the user that the session is **valid for a fixed TTL** (e.g. **1 hour**) and that further questions in that window use this context.
  3. Send **OTP** to that email; user enters OTP in the widget.
  4. On success, mark session **verified** for that email; proceed with slot filling (order id, product name, etc.) and L1 or ticket creation.
- **No Shopify login, no magic links** — only **email + OTP** for widget verification.

### 1.3 OTP (widget) — behavioral requirements

- Rate-limit sends and attempts; invalidate OTP after use or expiry.
- Session store: `session_id` → `asserted_email`, `verified_at`, `expires_at`, `store_id`, optional `bound_order_id` after disambiguation.
- After TTL expiry, **re-OTP** required for any new transactional request.

---

## 2. Verification, confidentiality, and prerequisites (cross-cutting)

### 2.1 Constraint: no cross-email order access

- You **must not** disclose order data unless the **verified channel identity** matches the **customer/order email** in the database (email channel: `From`; widget: OTP-proved email).
- **Friend’s order:** impossible to service from the wrong inbox; customer must use the **purchaser’s email** (and that person must be the one in the thread or OTP flow).

### 2.2 Prerequisites pattern

For each **Transactional** or **Ticket-led** module, define:

- **Required slots** (e.g. `order_id`, `product_query`, `issue_subtype`).
- **Verification gate:** `email_aligned` (email) or `otp_verified_session` (widget).
- **L1 action:** read-only, read+act (limited), or **create ticket only**.

### 2.3 Slot filling and back-and-forth

- Orchestrator state: `collect_slots` → `verify` (widget OTP) → `execute_l1` or `open_ticket` → `respond`.
- Ask **only** for the **next missing** prerequisite.
- Reuse **one verified session** on the widget for multiple questions within TTL (e.g. status then tracking for same order).

---

## 3. Use-case catalog — categorization (vetted)

**Legend**

- **K** = Knowledge (FAQ / KB; module enabled gates automation).  
- **T** = Transactional L1 (DB read / limited write after verification + slots).  
- **X** = Ticket-led (human resolves; L1 may intake + acknowledge + ticket).  
- **Catalog metadata (DB-backed)** = see §0.2; answers use **tool calls** against synced **category metadetails** when **`CATEGORY_METADETAILS`** is enabled (no per-category toggle in v1).  

| Module code | Customer-facing use-case | Primary pillar | Prerequisites (typical) | L1 automation (agentic) | Human / ticket |
|-------------|----------------------------|----------------|---------------------------|---------------------------|----------------|
| `ALL` | Global store context | — | — | Informs all replies | — |
| `FAQ` | General policies & “how we work” | **K** | None for pure policy | RAG / structured FAQ; **refund policy** lives here, not “status” | If out of scope → suggest email or ticket |
| `CATEGORY_METADETAILS` | Category-level product details from storefront sync | **Catalog metadata (DB-backed)** | Product or category resolution (name/SKU → category); **module must be enabled by vendor** | **Tool calls** to DB: read **category metadetails** fields for the resolved category(ies); use for factual answers store-wide | If disabled, off, or no row → KB / PDP link / ticket |
| `PRODUCT_FIT` | Product fit, sizing, compatibility | **K** *(optional light T: product resolve)* | Product name/SKU for specificity | Answer from KB + **category metadetails (if `CATEGORY_METADETAILS` enabled)** via tools + product metafields/chunks; link to PDP chart | Edge cases → ticket |
| `STORE_LOCAL` | Store hours, pickup, local | **K** | None | KB only | — |
| `FEEDBACK` | After-resolution feedback | **K** | Optional ticket id | Link to survey / ask once | Negative follow-up → human |
| `HUMAN_ESCALATION` | “I want a person” | **K** / routing | None or context | Ack + routing copy + create ticket if policy says so | Human handles queue |
| `ORDER_STATUS` | Where is my order | **T** | Verified identity + `order_id` (or disambiguation) | Read order state from DB; reply with status summary | If anomaly outside playbook → ticket |
| `ORDER_SUMMARY` | Order summary / receipt recap | **T** | Same | Read line items / totals from DB | Tax invoice edge cases → ticket if vendor policy says |
| `SHIPPING_TRACKING` | Carrier, tracking, ETA | **T** | Same | Read tracking fields from DB for that order | Carrier claim / dispute → **X** |
| `ORDER_CANCEL` | Cancel order | **T** | Same + business rules in DB | Eligibility check + cancel if allowed; else explain from KB | If ambiguous or edge case → **X** |
| `REFUND_STATUS` | Status of **my** refund / return payout | **T** | Verified identity + order (or return) reference | Read refund/return state from DB if modeled; else templated “we’ll update you” + **X** | Human if data missing |
| `INVENTORY_STOCK` | Is this in stock | **T** | `product_name` / SKU (widget may need session only if tied to customer cart—optional) | Read inventory from DB | Disambiguation across many SKUs |
| `NOT_RECEIVED_MARKED_DELIVERED` | Tracking says delivered, I don’t have the parcel | **X** | Verified identity + `order_id` | L1: confirm tracking snapshot + vendor policy snippet + **open ticket** | Human investigates carrier / claim |
| `SHIPMENT_STUCK_OR_DELAYED` | Shipment not moving / very late vs expectation | **X** | Verified identity + `order_id` | L1: last known scan + policy snippet + **open ticket** | Human chases carrier / ops |
| `PAYMENT_PROBLEM` | Double charge, wrong amount, promo failed, etc. | **X** | Verified identity + **order reference when payment is order-scoped**; some sub-intents need **last4 / date** as slots | L1: structured intake + **ticket**; **no** automated money movement | Human + finance tools |
| `ORDER_CHANGE` | Change address / items / qty | **X** | Verified identity + `order_id` + requested change | L1: **open ticket** + acknowledgement (human decides feasibility) | Human confirms “possible / not possible” |
| `RETURN_EXCHANGE` | Start return or exchange | **X** | Verified identity + `order_id` (+ reason) | L1: policy from KB + **open ticket** (or portal link if you add later) | Human / ops fulfills RMA |
| `WARRANTY` | Warranty claim (post–return window) | **X** | Verified identity + proof-of-purchase / order | L1: intake + **ticket** | Human adjudicates |
| `WRONG_ITEM` | Wrong / damaged / missing item | **X** | Verified identity + `order_id` + issue type (+ photos on email) | L1: acknowledge + policy + **ticket** with structured fields | Human resolves (reship/refund) |
| `COMPLAINT` | Strong dissatisfaction | **X** | **Strict verification** same as other fiber flows | L1: empathetic ack + **ticket** + severity | Human owns resolution |

**Removed vague module:** `DELIVERY_PROBLEM` is **removed** as a single umbrella. Use **`NOT_RECEIVED_MARKED_DELIVERED`** and **`SHIPMENT_STUCK_OR_DELAYED`** so intents and playbooks stay **specific**.

---

## 4. Design principles (knowledge modules)

### 4.1 Modular enablement

- Each **use-case** = one **sub-module**. Vendor **enables** modules they want.
- **Knowledge** modules: enabled when **required vendor questions** (`shared_field_id`) are complete.
- **Transactional / ticket** modules: additionally require **technical readiness** (e.g. order data in DB, ticket pipeline) — product-defined.
- **`CATEGORY_METADETAILS`:** **no** vendor questionnaire — only a **single store-level toggle** (**on** / **off**). **On** = agent may use **tool calls** to read **category metadetails** for **all** synced categories/products; **off** = those tools are not invoked for customer answers. **No per-category** enable/disable in v1.

### 4.2 Single source of truth (shared answers)

- Vendor questions map to **`shared_field_id`**. Same id = one value; edit propagates everywhere to avoid contradictions.

### 4.3 Duplication in the UI

- Same question may appear in multiple modules for **context**; storage is still keyed by `shared_field_id`.

### 4.4 `ALL` (global)

- Baseline questions apply to every store regardless of modules.

### 4.5 Document boundaries

- This doc specifies **business rules** and **conceptual field identity** for alignment across modules. **Schema, UI copy, exact OTP TTL**, and chunking strategy are implementation details elsewhere — and **physical schema / API names need not match** the `shared_field_id` or module codes in this file (see **Read this first (integration)** at the top).

---

## 5. Shared field ID reference (cross-module truth)

*The keys in the first column are **spec labels** for “one conceptual answer, many modules.” In your app they might be DB columns, JSON keys, or CMS field handles with **different** names — that is **expected** when integrating (see **Read this first**).*

| `shared_field_id` | Typical use |
|-------------------|-------------|
| `sf_brand_display_name` | Brand as customers know it |
| `sf_store_one_liner` | What you sell / for whom |
| `sf_official_languages` | Languages you support in writing |
| `sf_support_channels` | Email, phone, chat, hours |
| `sf_support_first_response_sla` | Expected time to first human/bot reply |
| `sf_tone_and_words_to_avoid` | Voice + banned terms |
| `sf_order_id_help` | How customers find order # / confirmation |
| `sf_first_message_checklist` | What to include when contacting support |
| `sf_policy_link_terms` | Terms of sale URL |
| `sf_policy_link_privacy` | Privacy policy URL |
| `sf_policy_link_returns` | Return policy URL (if separate) |
| `sf_privacy_support_paragraph` | Short: how data is used in support |
| `sf_shipping_regions_served` | Where you ship |
| `sf_shipping_regions_excluded` | Where you do not ship |
| `sf_processing_time_before_ship` | Dispatch / handling time |
| `sf_carriers_and_tracking_policy` | Carriers + when tracking is provided |
| `sf_shipping_methods_and_transit` | Methods + realistic transit ranges |
| `sf_shipping_cost_model` | Free/paid/flat/dynamic |
| `sf_dispatch_cutoff` | Same-day rules if any |
| `sf_address_correction_policy` | Wrong address, failed delivery fees |
| `sf_customs_duties_policy` | International duties disclaimer |
| `sf_delivered_not_received_policy` | “Delivered but I don’t have it” |
| `sf_major_delay_communication` | Strikes, weather, backlog messaging |
| `sf_stuck_shipment_customer_steps` | What customer should do while shipment appears stalled |
| `sf_cancellation_window` | When cancel is allowed |
| `sf_cancellation_how_to_request` | How customer asks to cancel |
| `sf_cancellation_preorder_digital` | Special rules if applicable |
| `sf_order_change_allowed_until` | Until when edits are possible (for KB / human context) |
| `sf_order_change_how_to_request` | How to request change (human path) |
| `sf_order_change_not_possible_next_step` | After cutoff / shipped |
| `sf_return_window` | Days / trigger event |
| `sf_return_condition_requirements` | Tags, unworn, packaging |
| `sf_return_shipping_payer` | Who pays return shipping |
| `sf_exchange_policy` | Swap vs credit vs refund |
| `sf_how_to_start_return` | Portal/email/steps |
| `sf_non_returnable_categories` | Final sale, hygiene, etc. |
| `sf_refund_methods` | Original payment vs store credit |
| `sf_refund_timeline_after_approval` | Time to money back |
| `sf_partial_refund_rules` | Open box, missing parts |
| `sf_store_credit_rules` | Expiry, combinable |
| `sf_payment_methods_accepted` | Cards, wallets, regional limits |
| `sf_promo_discount_rules` | Stacking, exclusions |
| `sf_tax_display_policy` | What’s included at checkout |
| `sf_price_adjustment_policy` | Post-purchase price match if any |
| `sf_failed_payment_guidance` | What customer should retry |
| `sf_wrong_item_report_deadline` | Time limit to report |
| `sf_wrong_item_evidence` | Photos, packing slip, etc. |
| `sf_wrong_item_remedies` | Reship, refund, return-first (human executes) |
| `sf_damage_carrier_vs_warehouse` | How you explain difference |
| `sf_warranty_duration_scope` | Length + what’s covered |
| `sf_warranty_voiders` | Misuse, unauthorized repair |
| `sf_warranty_claim_process` | Proof, repair, replace |
| `sf_sizing_fit_guidance` | Fit notes + size chart link |
| `sf_compatibility_notes` | Devices, voltage, region |
| `sf_materials_care_limitations` | Care, allergens, limitations |
| `sf_back_in_stock_policy` | Waitlist / notify / none |
| `sf_preorder_policy` | Charge timing, ship-by, cancel |
| `sf_discontinued_product_policy` | Alternatives / final sale |
| `sf_physical_locations_hours` | Addresses + hours + holidays |
| `sf_pickup_rules` | Hold time, ID, process |
| `sf_instore_vs_online_inventory` | Same stock or not |
| `sf_human_escalation_when` | Clear “ask a human” path |
| `sf_complaint_acknowledgement_sla` | How fast you acknowledge |
| `sf_complaint_supervisor_escalation` | When a lead reviews |
| `sf_abusive_contact_policy` | Neutral boundary statement |
| `sf_feedback_csat_process` | Survey link / when sent |
| `sf_order_summary_tax_invoice_note` | Invoices, VAT, limitations |
| `sf_double_charge_intake` | What customer should send for duplicate charge claims |

---

## 6. `ALL` — Global / store-wide questions

| # | Question (vendor-facing) | Why it matters | `shared_field_id` |
|---|-------------------------|----------------|-------------------|
| G1 | What is your **brand or store name** as customers should see it? | Consistent identity. | `sf_brand_display_name` |
| G2 | In **one or two sentences**, what do you sell and who is it for? | Grounds answers. | `sf_store_one_liner` |
| G3 | Which **languages** do you officially support in email/support? | Sets expectations. | `sf_official_languages` |
| G4 | What are your **official support channels** (email, phone, chat) and **hours**? | Human + ticket paths. | `sf_support_channels` |
| G5 | Typical **first response time** for human support? | Trust / SLA. | `sf_support_first_response_sla` |
| G6 | **Tone** and **words or promises** to avoid. | Brand-safe automation. | `sf_tone_and_words_to_avoid` |
| G7 | How customers find **order number** / confirmation. | All order-related flows. | `sf_order_id_help` |
| G8 | What customers should **always include** when contacting support. | Faster resolution. | `sf_first_message_checklist` |
| G9 | Link to **terms of sale**. | Legal grounding. | `sf_policy_link_terms` |
| G10 | Link to **privacy policy**. | Trust. | `sf_policy_link_privacy` |
| G11 | Link to **return / refund policy** if separate. | Canonical policy URL. | `sf_policy_link_returns` |
| G12 | **Short paragraph**: how data is used in support. | Privacy framing. | `sf_privacy_support_paragraph` |

---

## 7. Per-module vendor question sets

*Required completion gates the **Knowledge** aspect of each module. **Transactional** and **ticket** behaviors additionally depend on §3 and product integration.*

### 7.1 `ORDER_STATUS` — Order status

| # | Question | `shared_field_id` |
|---|----------|-------------------|
| OS1 | **Normal processing time** before shipment? | `sf_processing_time_before_ship` |
| OS2 | **Proactive status updates** (if any)? | *(optional `sf_order_status_proactive_updates`)* |
| OS3 | If **delayed before shipment**, what do you tell the customer? | `sf_major_delay_communication` |
| OS4 | **Ship to** / **do not ship to**? | `sf_shipping_regions_served`, `sf_shipping_regions_excluded` |
| OS5 | **Order # help** + checklist | `sf_order_id_help`, `sf_first_message_checklist` |

**Transactional note:** L1 reads **order record** from DB after **email match + order disambiguation**.

---

### 7.2 `INVENTORY_STOCK` — Inventory / stock

| # | Question | `shared_field_id` |
|---|----------|-------------------|
| IV1–IV5 | *(unchanged — back-in-stock, pre-order, discontinued, in-store vs online, disclaimer)* | `sf_back_in_stock_policy`, `sf_preorder_policy`, `sf_discontinued_product_policy`, `sf_instore_vs_online_inventory`, optional disclaimer |

**Transactional note:** L1 needs **product identifier**; may run **without** full OTP if policy allows anonymous stock checks on widget — **product decision**; if tied to “my cart order,” require verified session.

---

### 7.3 `FAQ` — General FAQ (includes **refund policy**, not refund status)

| # | Question | `shared_field_id` |
|---|----------|-------------------|
| FQ1–FQ8 | Shipping, returns, **refunds policy summary**, payment, promo, tax, contact, policy links | *(as in prior doc)* |

---

### 7.4 `ORDER_CANCEL` — Order cancellation

| # | Question | `shared_field_id` |
|---|----------|-------------------|
| CX1–CX5 | Window, how to request, next step if impossible, pre-order, refund timing | `sf_cancellation_*`, `sf_refund_*`, `sf_order_change_not_possible_next_step` |

**Transactional note:** L1 runs **eligibility + cancel** in DB/Shopify ruleset; otherwise KB explanation + optional ticket.

---

### 7.5 `HUMAN_ESCALATION`

| # | Question | `shared_field_id` |
|---|----------|-------------------|
| HE1–HE4 | When to ask human, channels, SLA, checklist | `sf_human_escalation_when`, `sf_support_*`, `sf_first_message_checklist` |

---

### 7.6 `COMPLAINT` — Ticket-led, strict verification

| # | Question | `shared_field_id` |
|---|----------|-------------------|
| CP1–CP6 | Ack, SLA, supervisor, remedies summary, abuse policy, channels | `sf_complaint_*`, `sf_wrong_item_remedies`, `sf_refund_methods`, `sf_support_channels` |

**Implementation note:** Always **verify identity** like other fiber flows; **create ticket**; human resolves.

---

### 7.7 `ORDER_SUMMARY`

| # | Question | `shared_field_id` |
|---|----------|-------------------|
| SM1–SM4 | Receipt naming, tax invoice note, checklist, order # help | optional receipt naming, `sf_order_summary_tax_invoice_note`, `sf_first_message_checklist`, `sf_order_id_help` |

---

### 7.8 `REFUND_STATUS` — Transactional (distinct from FAQ refund policy)

| # | Question | `shared_field_id` |
|---|----------|-------------------|
| RF1–RF6 | Methods, timeline, after return received, partial rules, store credit, delay messaging | `sf_refund_*`, optional `sf_refund_after_return_received`, `sf_refund_delay_exception` |

**Transactional note:** L1 reads **refund/return pipeline state** from DB when available; if not modeled, fall back to **ticket** after verification.

---

### 7.9 `SHIPPING_TRACKING`

| # | Question | `shared_field_id` |
|---|----------|-------------------|
| ST1–ST6 | Carriers, methods, cost, cutoff, regions, customs | *(as before)* |

**Transactional note:** L1 reads **tracking fields** for **verified order**.

---

### 7.10 `WRONG_ITEM` — Ticket-led

| # | Question | `shared_field_id` |
|---|----------|-------------------|
| WI1–WI6 | Deadline, evidence, remedies, damage explanation, return shipping, links | `sf_wrong_item_*`, `sf_return_shipping_payer`, `sf_policy_link_returns`, `sf_how_to_start_return` |

---

### 7.11 `RETURN_EXCHANGE` — Ticket-led initiation

| # | Question | `shared_field_id` |
|---|----------|-------------------|
| RE1–RE6 | Window, condition, non-returnable, shipping, exchange, refund timing | `sf_return_*`, `sf_exchange_policy`, `sf_how_to_start_return`, `sf_refund_*` |

---

### 7.12 `NOT_RECEIVED_MARKED_DELIVERED` — Ticket-led (replaces vague “delivery problem”)

| # | Question | `shared_field_id` |
|---|----------|-------------------|
| NR1 | **“Delivered” but not received** — customer steps, wait time, claim | `sf_delivered_not_received_policy` |
| NR2 | **Carrier** / claim expectations | `sf_carriers_and_tracking_policy` |

**Flow:** verify identity + order → show last tracking → policy snippet → **open ticket**.

---

### 7.13 `SHIPMENT_STUCK_OR_DELAYED` — Ticket-led

| # | Question | `shared_field_id` |
|---|----------|-------------------|
| SD1 | When shipment seems **stuck** or **far past** expected range, what should customer do first? | `sf_stuck_shipment_customer_steps` |
| SD2 | How you communicate **major delays** | `sf_major_delay_communication` |
| SD3 | **Carriers** reference | `sf_carriers_and_tracking_policy` |

**Flow:** verify + order → read last scan dates → **open ticket** for human follow-up.

---

### 7.14 `PAYMENT_PROBLEM` — Ticket-led (prerequisites vary)

| # | Question | `shared_field_id` |
|---|----------|-------------------|
| PP1–PP6 | Payment methods, failed payment, **double charge intake**, promo, tax, price adjust | `sf_payment_methods_accepted`, `sf_failed_payment_guidance`, `sf_double_charge_intake`, `sf_promo_discount_rules`, `sf_tax_display_policy`, `sf_price_adjustment_policy` |

**Prerequisites:** for **order-scoped** issues, require **verified identity + order id**; for **pre-purchase checkout** failures, may only have **email + description** → ticket with what you have.

---

### 7.15 `ORDER_CHANGE` — Ticket-led only

| # | Question | `shared_field_id` |
|---|----------|-------------------|
| OC1–OC4 | Until when changes are *sometimes* possible, how to request, impossible case, cancel alternative | `sf_order_change_*`, `sf_cancellation_*` |

**Flow:** never auto-change order in L1 v1; **open ticket** for human.

---

### 7.16 `WARRANTY` — Ticket-led

| # | Question | `shared_field_id` |
|---|----------|-------------------|
| WA1–WA5 | Scope, voiders, process, timeline optional, escalation | `sf_warranty_*`, `sf_complaint_supervisor_escalation` |

---

### 7.17 `PRODUCT_FIT`

| # | Question | `shared_field_id` |
|---|----------|-------------------|
| PF1–PF4 | Sizing, compatibility, materials, human edge cases | `sf_sizing_fit_guidance`, `sf_compatibility_notes`, `sf_materials_care_limitations`, `sf_human_escalation_when` |

---

### 7.18 `STORE_LOCAL`

| # | Question | `shared_field_id` |
|---|----------|-------------------|
| SL1–SL4 | Locations, pickup, inventory nuance, local returns | `sf_physical_locations_hours`, `sf_pickup_rules`, `sf_instore_vs_online_inventory`, `sf_how_to_start_return` |

---

### 7.19 `FEEDBACK`

| # | Question | `shared_field_id` |
|---|----------|-------------------|
| FB1–FB3 | CSAT process, negative follow-up optional, tone | `sf_feedback_csat_process`, optional negative follow-up, `sf_tone_and_words_to_avoid` |

---

### 7.20 `CATEGORY_METADETAILS` — Category metadetails (store-wide, DB via tools)

**Vendor configuration:** **One toggle only** — **Enabled** or **Disabled** for the store. There is **no** granular control per category or per product in this version.

**When enabled**

- The L1 agent may invoke **tool calls** that **read from the database** the **category metadetails** (and any related fields your sync pipeline persists — exact table/column names belong in the engineering schema doc).
- Coverage is **all products** that belong to synced categories: answers can draw on **metadetails for every category** present in the store’s data, after the orchestrator resolves **which category** applies (e.g. from product name/SKU → product → category).
- Typical use: **sizing/fit notes**, **materials**, **care**, **compatibility** text maintained at **category** level in Shopify (or equivalent) rather than retyped into the FAQ.

**When disabled**

- Do **not** call category-metadetails read tools for customer-facing answers.
- Fall back to **`PRODUCT_FIT` / FAQ** vendor text, PDP links, or escalation as appropriate.

**Prerequisites**

- Sync pipeline must persist category metadetails into the DB.
- Agent must still **resolve product/category** (slot filling) when the user asks about a specific item; tool calls return **fields**, not guesses.

**No `shared_field_id` questionnaire** for this module — policy text for *when* to cite storefront vs human lives in other modules (e.g. `PRODUCT_FIT`, `FAQ`).

---

## 8. L1 agentic implementation checklist (engineering)

### 8.1 Core services

- [ ] **Intent router** → module + pillar (K / T / X / catalog-metadata) — use **your** module/enum names if they differ from this doc.  
- [ ] **Tool-call layer** (or RPC): explicit functions that **query the database** for each concern — **orders**, **line items**, **fulfillment/tracking**, **inventory**, **refund/return state**, **products**, **categories**, **category metadetails** — using **real table/field names from your schema** (not necessarily any placeholder names in this plan). The LLM/agent must only assert facts returned by tools (plus vendor KB where allowed).  
- [ ] **Slot extractor** (per module manifest): `order_id`, `product_name`, `issue_subtype`, etc.  
- [ ] **Email adapter:** `from_email` + thread id; enforce **same-email** rule for T/X.  
- [ ] **Widget adapter:** session + **OTP** service + TTL (e.g. 1h).  
- [ ] **DB readers** (exposed as tools) for order, fulfillment, tracking, inventory, refund state (as available in your schema).  
- [ ] **Category metadetails tools:** e.g. resolve `product_id`/`sku` → `category_id` → **fetch metadetails record**; respect vendor **`CATEGORY_METADETAILS` enabled** flag before calling.  
- [ ] **Writers** only where allowed (e.g. cancel); **ticket creator** for all **X** modules.  

### 8.2 Manifests (per module)

- [ ] `required_slots`, `verification_gate`, `pillar`, `l1_actions[]`, `ticket_template_id` (for X).  
- [ ] **Disambiguation** rule when multiple orders match email.  

### 8.3 Knowledge

- [ ] Vendor `shared_field_id` storage + sync.  
- [ ] RAG/chunking with `module_code` metadata for **K** paths.  
- [ ] Store-level flag: **`category_metadetails_enabled`** (boolean) — gates category-metadetails **tool calls** only; no per-category flags in v1.  

### 8.4 Safety

- [ ] **No existence leak:** wrong email must not confirm others’ orders.  
- [ ] **Rate limits** on OTP and lookups.  
- [ ] **Guardrails** (existing) before LLM.  

### 8.5 Explicit non-goals (this phase)

- [ ] No Shopify OAuth login for customers.  
- [ ] No magic links.  
- [ ] No full automated ticket resolution workflow — humans own tickets.  

---

## 9. Optional `shared_field_id` backlog

- `sf_order_status_proactive_updates`  
- `sf_inventory_disclaimer`  
- `sf_receipt_naming`  
- `sf_refund_after_return_received`  
- `sf_refund_delay_exception`  
- `sf_negative_feedback_escalation`  

---

## 10. JUNOHUB implementation notes (engineering)

This section records **repo-specific** follow-ups, **operator** steps, and **environment** expectations for the L1 MVP wired into this codebase. It does not replace §1–9 above.

### 10.1 Database and Prisma

- After pulling changes that touch [`prisma/schema.prisma`](prisma/schema.prisma), run:
  - `npx prisma generate` (types for `Store.categoryMetadetailsEnabled`, `Store.aiModules`, `StorefrontChatConversation` OTP/session fields, etc.)
  - Apply schema to the DB: `npx prisma migrate deploy` (production) or `npx prisma db push` (dev only).
- Shared `Store` `select` shapes live in [`src/lib/prisma/storeSelects.ts`](src/lib/prisma/storeSelects.ts). If TypeScript still complains about unknown `select` keys, the generated client is stale — regenerate and restart the TS server in your IDE.

### 10.2 Partially implemented or deferred (vs full spec)

- **`l1State` on conversations:** Column exists; orchestrator does not yet persist a full `collect_slots | verified | execute | handoff` state machine JSON for every turn (logic is mostly derived per request).
- **`aiModules` JSON:** Stored on `Store` and read by the orchestrator; **no dashboard UI** yet to toggle individual modules — use `PATCH /api/stores/[storeId]` with `{ "aiModules": { "FAQ": true, "ORDER_STATUS": false, ... } }` or leave unset for defaults in code.
- **Ticket-led (X) “intake” logging:** Handoff copy is generated; optional `EmailLog` / `FlaggedEmail` rows with trigger `AI_TICKET_INTAKE` are not fully wired for every X path (Gmail L1 replies use trigger `AI_L1_REPLY` when the orchestrator composes the body).
- **Refund status tool:** Only if return/refund data exists on `CachedOrder` (or related JSON); otherwise orchestrator falls back to KB / ticket messaging.
- **Gmail auto-reply:** L1 runs when the message is not off-topic and passes the existing guards (not sparse, order id present when required, etc.); see [`src/lib/gmail/autoReplyPreview.ts`](src/lib/gmail/autoReplyPreview.ts).
- **Integration tests:** [`tests/gmail-auto-reply/`](tests/gmail-auto-reply/) was not extended in the MVP pass; unit tests live under [`tests/l1/`](tests/l1/).

### 10.3 Environment variables (checklist)

Set in `.env` (names only — **do not commit secrets**):

| Variable | Role |
|----------|------|
| `DATABASE_URL` | Required — Postgres for Prisma. |
| `GROQ_API_KEY` | Required for L1 orchestrator, intent router, storefront reply, Gmail flows using Groq. |
| `OPENAI_API_KEY` | Required for KB embeddings and optional OpenAI chat in KB RAG. |
| `OPENAI_EMBEDDING_MODEL` / `OPENAI_EMBEDDING_DIMENSIONS` | Optional — defaults in [`src/lib/kb/embeddingMeta.ts`](src/lib/kb/embeddingMeta.ts). |
| `OPENAI_CHAT_MODEL` | Optional — KB “Ask” chat model override. |
| `GROQ_MODEL` | Optional — override default Groq model. |
| `STOREFRONT_OTP_SECRET` | **Recommended in production** — salt for OTP hashing ([`src/lib/storefront-chat/otpCrypto.ts`](src/lib/storefront-chat/otpCrypto.ts)); defaults to a dev string if unset. |
| `SMTP_*` | Required for **real** storefront OTP emails and other mail; without SMTP, OTP send is logged/skipped per [`src/lib/email.ts`](src/lib/email.ts). |
| Gmail / Pub/Sub (`GOOGLE_*`, `GMAIL_*`, etc.) | As already used for inbound mail and webhooks. |

**From your side:** keep SMTP and AI keys valid; set a strong `STOREFRONT_OTP_SECRET` in production; run `prisma generate` + migrations after deploy.

---