# AI modules, questions, and sample answers (shoe store)

This document is aligned with [`docs/req-AI.md`](req-AI.md): **module codes**, **pillars** (K / T / X / catalog metadata), and **`shared_field_id`** labels. Example answers describe a **fictional** store focused on **shoes for both men and women** — replace with your real policies, URLs, and numbers.

**Legend**

| Code | Meaning |
|------|---------|
| **K** | Knowledge (FAQ / KB) |
| **T** | Transactional L1 (verified identity + DB reads) |
| **X** | Ticket-led (human resolves) |
| **Cat** | Catalog metadata (DB-backed category metadetails; **toggle only**, no per-module questionnaire) |

---

## 1. Module catalog (what each module is for)

| Module code | Customer-facing use | Pillar | Vendor “questions” source |
|-------------|----------------------|--------|---------------------------|
| `ALL` | Global store context | — | §6 global questions (`sf_*`) |
| `FAQ` | General policies, how you work | **K** | Shared fields: shipping, returns, payments, contact, policy links, etc. |
| `CATEGORY_METADETAILS` | Category-level facts from your sync | **Cat** | **No questionnaire** — store toggle on/off only |
| `PRODUCT_FIT` | Fit, sizing, materials | **K** | `sf_sizing_fit_guidance`, `sf_compatibility_notes`, `sf_materials_care_limitations`, `sf_human_escalation_when` |
| `STORE_LOCAL` | Hours, pickup, local | **K** | `sf_physical_locations_hours`, `sf_pickup_rules`, `sf_instore_vs_online_inventory`, `sf_how_to_start_return` |
| `FEEDBACK` | Surveys / thanks | **K** | `sf_feedback_csat_process`, tone (`sf_tone_and_words_to_avoid`) |
| `HUMAN_ESCALATION` | “I want a person” | **K** | `sf_human_escalation_when`, `sf_support_*`, `sf_first_message_checklist` |
| `ORDER_STATUS` | Where is my order | **T** | `sf_processing_time_before_ship`, delays, regions, `sf_order_id_help`, checklist |
| `ORDER_SUMMARY` | Receipt recap | **T** | `sf_order_summary_tax_invoice_note`, checklist, order # help |
| `SHIPPING_TRACKING` | Carrier, tracking, ETA | **T** | Carriers, methods, cost, cutoff, regions, customs (`sf_*` shipping set) |
| `ORDER_CANCEL` | Cancel order | **T** | `sf_cancellation_*`, refunds, `sf_order_change_not_possible_next_step` |
| `REFUND_STATUS` | Refund / payout status | **T** | `sf_refund_*` |
| `INVENTORY_STOCK` | In stock? | **T** | `sf_back_in_stock_policy`, `sf_preorder_policy`, `sf_discontinued_product_policy`, `sf_instore_vs_online_inventory` |
| `NOT_RECEIVED_MARKED_DELIVERED` | Tracking says delivered, I don’t have it | **X** | `sf_delivered_not_received_policy`, `sf_carriers_and_tracking_policy` |
| `SHIPMENT_STUCK_OR_DELAYED` | Shipment stuck / very late | **X** | `sf_stuck_shipment_customer_steps`, `sf_major_delay_communication`, carriers |
| `PAYMENT_PROBLEM` | Double charge, promo failed, etc. | **X** | `sf_payment_methods_accepted`, `sf_failed_payment_guidance`, `sf_double_charge_intake`, promo, tax, price adjust |
| `ORDER_CHANGE` | Change address / items / qty | **X** | `sf_order_change_*`, `sf_cancellation_*` |
| `RETURN_EXCHANGE` | Start return or exchange | **X** | `sf_return_*`, `sf_exchange_policy`, `sf_how_to_start_return`, `sf_refund_*` |
| `WARRANTY` | Warranty claim | **X** | `sf_warranty_*`, escalation |
| `WRONG_ITEM` | Wrong / damaged / missing item | **X** | `sf_wrong_item_*`, return shipping, policy links |
| `COMPLAINT` | Strong dissatisfaction | **X** | `sf_complaint_*`, remedies, `sf_support_channels` |

---

## 2. `ALL` — Global questions (G1–G12) + sample answers (shoe store)

| # | Question | `shared_field_id` | Sample answer (men’s & women’s shoes) |
|---|----------|-------------------|----------------------------------------|
| G1 | Brand / store name as customers see it | `sf_brand_display_name` | **Stride & Sole** |
| G2 | One or two sentences: what you sell and for whom | `sf_store_one_liner` | We design and sell **men’s and women’s footwear** — from everyday sneakers and casual shoes to dress and seasonal styles — for customers who care about **fit, comfort, and lasting quality**. |
| G3 | Languages you support in writing | `sf_official_languages` | **English** (email and chat). We can use translation tools for other languages when needed, but official policies and contracts are in English. |
| G4 | Support channels and hours | `sf_support_channels` | **Email:** support@strideandsole.example · **Chat:** storefront widget on our site · **Hours:** Mon–Fri 9:00–18:00 ET; we reply to email within one business day outside chat hours. |
| G5 | Typical first response time | `sf_support_first_response_sla` | **Chat/widget:** usually within a few minutes during business hours. **Email:** within **24 hours** on business days. |
| G6 | Tone and words to avoid | `sf_tone_and_words_to_avoid` | Tone: **friendly, clear, never pushy**. Avoid guaranteeing exact delivery dates, medical claims (e.g. “cures foot pain”), or saying “final sale” unless the product is tagged final sale. |
| G7 | How customers find order # / confirmation | `sf_order_id_help` | Your **order number** appears in your order confirmation email and on your **order status page** (link in that email). It looks like **#1001** or **#SS-1001** depending on our format. |
| G8 | What to include when contacting support | `sf_first_message_checklist` | Please include: **order number**, **email used at checkout**, **shoe model name or SKU** (if about a product), and **photos** for damage/wrong-item issues. |
| G9 | Terms of sale URL | `sf_policy_link_terms` | `https://strideandsole.example/policies/terms-of-service` |
| G10 | Privacy policy URL | `sf_policy_link_privacy` | `https://strideandsole.example/policies/privacy-policy` |
| G11 | Return / refund policy URL (if separate) | `sf_policy_link_returns` | `https://strideandsole.example/policies/refund-policy` |
| G12 | Short paragraph: data in support | `sf_privacy_support_paragraph` | We use your **email, order history, and messages** only to **fulfill orders, answer questions, and improve support**. We don’t sell personal data. Full details are in our privacy policy. |

---

## 3. `FAQ` — Typical topics (FQ1–FQ8 style) + sample answers

*The spec groups FAQ under shipping, returns, refunds **policy**, payments, promo, tax, contact, and policy links. Below are concise shoe-store examples.*

| Topic | Sample answer |
|-------|----------------|
| **Shipping regions** | We ship within **United States** and **Canada**. We do not ship to P.O. boxes for oversized shoe cartons in some carriers — checkout will flag if your address isn’t supported. |
| **Processing time** | In-stock shoes usually ship within **1–2 business days** (see `sf_processing_time_before_ship` in Order status). |
| **Returns policy (policy, not status)** | Unworn shoes in **original box** with tags may be returned within **30 days** of delivery for a refund or exchange; **final sale** and worn items are excluded — see our return policy page. |
| **Refund policy (timeline, not order status)** | Approved refunds are issued to the **original payment method** within **5–10 business days** after we receive the return at our warehouse. |
| **Payments** | We accept major **credit/debit cards**, **Shop Pay**, **PayPal**, and **Apple Pay** where enabled. |
| **Promotions** | One promo code per order unless stated; some **exclusions** apply on limited releases and collaboration shoes. |
| **Tax** | Taxes are **estimated at checkout** and finalized when the order ships, based on shipping address. |
| **Contact** | Prefer **order # + email** for fastest help; use the same email you used to purchase. |

---

## 4. Per-module questions and sample answers

### 4.1 `ORDER_STATUS` (OS1–OS5)

| # | Question | `shared_field_id` | Sample answer |
|---|----------|-------------------|----------------|
| OS1 | Normal processing before shipment? | `sf_processing_time_before_ship` | Most **in-stock** men’s and women’s shoes ship within **1–2 business days**. During launches or sales, handling may extend to **3–5 business days** — we’ll email you if there’s a delay. |
| OS2 | Proactive updates? | *(optional)* | We email **tracking** when your order ships. For delays, we send an update with a **revised estimate**. |
| OS3 | If delayed before shipment | `sf_major_delay_communication` | If your **size or color** is oversold, we’ll email within **48 hours** with options: **wait**, **swap**, or **cancel** for a full refund. |
| OS4 | Ship to / not ship to | `sf_shipping_regions_served`, `sf_shipping_regions_excluded` | **We ship:** US (48 states), DC, Canada. **We don’t ship:** freight-forwarding addresses we can’t verify, some **remote territories** — checkout will block unsupported zones. |
| OS5 | Order # help + checklist | `sf_order_id_help`, `sf_first_message_checklist` | *(Same as G7/G8 in §2.)** |

---

### 4.2 `INVENTORY_STOCK` (IV1–IV5 topics)

| Topic | `shared_field_id` | Sample answer |
|-------|-------------------|----------------|
| Back in stock | `sf_back_in_stock_policy` | Popular **sizes (e.g. women’s 8, men’s 10)** can sell out — use **“Notify me”** on the product page; we’ll email when we restock. |
| Pre-orders | `sf_preorder_policy` | **Limited drops** may be pre-order: you’re charged at checkout; we ship by the **stated date** or earlier if ready. |
| Discontinued | `sf_discontinued_product_policy` | When a **style is discontinued**, we remove or mark it **sold out** and may suggest a **similar model** in email if you ask support. |
| In-store vs online | `sf_instore_vs_online_inventory` | **Online stock** is separate from our **flagship store** inventory — an item may be online-only or store-only; ask us with **SKU** to check. |

---

### 4.3 `ORDER_CANCEL` (CX1–CX5 topics)

| Topic | `shared_field_id` | Sample answer |
|-------|-------------------|----------------|
| Cancellation window | `sf_cancellation_window` | Cancel **before shipment** for a full refund. Once **tracking** exists, cancellation may not be possible — start a **return** instead. |
| How to request | `sf_cancellation_how_to_request` | Email **support@…** with **order #** or use **Order status** → Cancel if the button is available. |
| If cancel not possible | `sf_order_change_not_possible_next_step` | If the package **already shipped**, please **refuse delivery** or use our **return portal** after delivery. |
| Pre-order / special | `sf_cancellation_preorder_digital` | Pre-order **collab shoes** may have stricter rules — see the product page; some are **non-cancellable** after 24 hours. |
| Refund timing | `sf_refund_timeline_after_approval` | *(Align with FAQ)* **5–10 business days** after approval to original payment method. |

---

### 4.4 `HUMAN_ESCALATION` (HE1–HE4 topics)

| Topic | `shared_field_id` | Sample answer |
|-------|-------------------|----------------|
| When to escalate | `sf_human_escalation_when` | We bring in a human for **billing disputes**, **damaged/lost** shipments, **exchange exceptions**, or whenever **automation can’t verify** your order. |
| Channels / SLA | `sf_support_*` | Email and chat per **§2 G4/G5**. |
| Checklist | `sf_first_message_checklist` | *(Same as G8.)** |

---

### 4.5 `COMPLAINT` (CP1–CP6 topics)

| Topic | `shared_field_id` | Sample answer |
|-------|-------------------|----------------|
| Acknowledgement | `sf_complaint_acknowledgement_sla` | We acknowledge serious complaints within **24 business hours** and aim for a full reply within **3 business days**. |
| Supervisor | `sf_complaint_supervisor_escalation` | Repeated service failures or **order errors over $200** are escalated to a **lead**. |
| Remedies | `sf_wrong_item_remedies`, `sf_refund_methods` | We may offer **refund, replacement, or store credit** per policy and case. |
| Abuse | `sf_abusive_contact_policy` | We protect our team: **harassment or threats** may result in **restricted support channels** per our terms. |

---

### 4.6 `ORDER_SUMMARY` (SM1–SM4 topics)

| Topic | `shared_field_id` | Sample answer |
|-------|-------------------|----------------|
| Tax / invoice note | `sf_order_summary_tax_invoice_note` | Order emails show **subtotal, shipping, tax estimate**. A **formal VAT invoice** for EU/CA B2B may be requested by email with **order #** and **tax ID**. |
| Checklist / order # | `sf_first_message_checklist`, `sf_order_id_help` | *(Same as §2.)** |

---

### 4.7 `REFUND_STATUS` (RF1–RF6 topics)

| Topic | `shared_field_id` | Sample answer |
|-------|-------------------|----------------|
| Methods | `sf_refund_methods` | **Original payment** or **store credit** if you chose credit at return submission. |
| Timeline | `sf_refund_timeline_after_approval` | **5–10 business days** after the return is **received and inspected** at our warehouse. |
| Partial refunds | `sf_partial_refund_rules` | Partial refunds may apply if **shoes show wear** or **accessories are missing** from the box. |
| Store credit | `sf_store_credit_rules` | Store credit **expires in 12 months** and can combine with one promo unless stated otherwise. |

---

### 4.8 `SHIPPING_TRACKING` (ST1–ST6 topics)

| Topic | Typical `shared_field_id` | Sample answer |
|-------|---------------------------|----------------|
| Carriers / tracking | `sf_carriers_and_tracking_policy` | We use **UPS**, **FedEx**, and **USPS**; tracking is emailed when the **label is created**. |
| Methods / transit | `sf_shipping_methods_and_transit` | **Standard:** 3–7 business days; **Express:** 2–3 business days (US). |
| Cost | `sf_shipping_cost_model` | **Free standard shipping** over **$75** US; otherwise rates shown at checkout. |
| Cutoff | `sf_dispatch_cutoff` | Orders before **12:00 ET** ship same business day when possible. |
| Customs | `sf_customs_duties_policy` | **Canada/EU:** duties and taxes may be **COD or prepaid** per carrier — shown at checkout. |

---

### 4.9 `WRONG_ITEM` (WI1–WI6 topics)

| Topic | `shared_field_id` | Sample answer |
|-------|-------------------|----------------|
| Report deadline | `sf_wrong_item_report_deadline` | Report **wrong size sent**, **color errors**, or **damage** within **14 days** of delivery. |
| Evidence | `sf_wrong_item_evidence` | Send **photos of the shoe box label**, **both shoes**, and **packing slip**. |
| Remedies | `sf_wrong_item_remedies` | We’ll offer **free return label + exchange** or **full refund** if we shipped the wrong SKU. |

---

### 4.10 `RETURN_EXCHANGE` (RE1–RE6 topics)

| Topic | `shared_field_id` | Sample answer |
|-------|-------------------|----------------|
| Window | `sf_return_window` | **30 days** from delivery; shoes must be **unworn** with **tags and original box**. |
| Condition | `sf_return_condition_requirements` | **No visible wear** on soles; **laces and insoles** included; **no perfume/smoke** odor for health reasons. |
| Non-returnable | `sf_non_returnable_categories` | **Socks**, **insoles** if opened, **final sale** collaborations, **clearance** marked as final. |
| Return shipping | `sf_return_shipping_payer` | **Customer pays** return shipping unless we **erred** (wrong item) — then we provide a **prepaid label**. |
| Exchange | `sf_exchange_policy` | **Size exchanges** are free on first exchange for the **same model** if in stock; otherwise refund. |

---

### 4.11 `NOT_RECEIVED_MARKED_DELIVERED` (NR1–NR2)

| Topic | `shared_field_id` | Sample answer |
|-------|-------------------|----------------|
| Steps | `sf_delivered_not_received_policy` | Check **neighbors / front desk**, **carrier proof of delivery photo**, wait **24 hours**, then email us with **order #**. |
| Carrier | `sf_carriers_and_tracking_policy` | We open a **carrier trace**; if confirmed lost, we **reship or refund** after investigation (often **5–10 business days**). |

---

### 4.12 `SHIPMENT_STUCK_OR_DELAYED` (SD1–SD3)

| Topic | `shared_field_id` | Sample answer |
|-------|-------------------|----------------|
| Customer steps | `sf_stuck_shipment_customer_steps` | If tracking **hasn’t moved 5+ business days**, email us with **order #** — we file a **carrier inquiry**. |
| Major delays | `sf_major_delay_communication` | Weather or peak season: we post notices on the **site banner** and send **delay emails** when we know. |
| Carriers | `sf_carriers_and_tracking_policy` | *(Same as shipping.)** |

---

### 4.13 `PAYMENT_PROBLEM` (PP1–PP6 topics)

| Topic | `shared_field_id` | Sample answer |
|-------|-------------------|----------------|
| Payment methods | `sf_payment_methods_accepted` | Cards, Shop Pay, PayPal, Apple Pay — region-dependent. |
| Failed payment | `sf_failed_payment_guidance` | Retry with another card; ensure **billing matches bank**; contact bank if **3D Secure** fails. |
| Double charge | `sf_double_charge_intake` | Send **order #**, **two charge amounts**, and **bank screenshots**; we resolve within **5 business days**. |
| Promo / tax / price | `sf_promo_discount_rules`, `sf_tax_display_policy`, `sf_price_adjustment_policy` | One code per order; tax per address; **price adjustments** within **7 days** if we run a public sale on the same SKU. |

---

### 4.14 `ORDER_CHANGE` (OC1–OC4)

| Topic | `shared_field_id` | Sample answer |
|-------|-------------------|----------------|
| Until when | `sf_order_change_allowed_until` | **Address changes** only before **warehouse pick** — usually **same day** if before **12:00 ET**. |
| How to request | `sf_order_change_how_to_request` | Email **support@…** with **order #** and **new address**; we can’t guarantee after ship. |
| If impossible | `sf_order_change_not_possible_next_step` | After ship, **redirect or hold** with carrier when possible — fees may apply. |
| Cancel alternative | `sf_cancellation_*` | *(See cancel section.)** |

---

### 4.15 `WARRANTY` (WA1–WA5)

| Topic | `shared_field_id` | Sample answer |
|-------|-------------------|----------------|
| Scope | `sf_warranty_duration_scope` | **Manufacturing defects** (e.g. **sole separation**, **bad stitching**) for **6 months** from delivery. |
| Void | `sf_warranty_voiders` | **Normal wear**, **water damage** beyond materials rating, **unauthorized repair**, **cut or altered** shoes. |
| Process | `sf_warranty_claim_process` | Email **photos + order #**; we may ask you to **ship shoes for inspection**; **repair or replace** at our discretion. |

---

### 4.16 `PRODUCT_FIT` (PF1–PF4)

| Topic | `shared_field_id` | Sample answer |
|-------|-------------------|----------------|
| Sizing | `sf_sizing_fit_guidance` | **Men’s and women’s** sizes use **US Brannock-style** charts; **wide** widths available on select models — see each **PDP size chart**. Half sizes: **order up** if between sizes for closed-toe dress shoes. |
| Compatibility | `sf_compatibility_notes` | **Orthotic-friendly** models list **removable insole** in specs; not all dress shoes fit thick orthotics. |
| Materials / care | `sf_materials_care_limitations` | **Leather:** brush + conditioner; **suede:** spray + soft brush; **knit:** cold hand wash only for some — follow **care card in box**. |
| Human edge cases | `sf_human_escalation_when` | **Custom orthotic fit** or **medical foot conditions** — we don’t give medical advice; we suggest a **specialist** and our **widest lasts**. |

---

### 4.17 `STORE_LOCAL` (SL1–SL4)

| Topic | `shared_field_id` | Sample answer |
|-------|-------------------|----------------|
| Locations / hours | `sf_physical_locations_hours` | **Flagship:** 123 Example St, NY — **Mon–Sat 10–19**, Sun 12–18 (example). |
| Pickup | `sf_pickup_rules` | **Buy online, pick up in store** — bring **ID + order email**; hold **7 days**. |
| Inventory | `sf_instore_vs_online_inventory` | **Store try-on** stock may differ from **warehouse** — ask staff to **transfer** if needed. |
| Local returns | `sf_how_to_start_return` | **In-store returns** for online orders with **QR code** from return portal. |

---

### 4.18 `FEEDBACK` (FB1–FB3)

| Topic | `shared_field_id` | Sample answer |
|-------|-------------------|----------------|
| CSAT | `sf_feedback_csat_process` | After **delivery**, we may send a **short survey** (email); optional **review link** for verified buyers. |
| Tone | `sf_tone_and_words_to_avoid` | *(See G6.)** |

---

### 4.19 `CATEGORY_METADETAILS`

- **No written questionnaire** in the spec.
- **Configuration:** one store toggle — when **enabled**, the agent reads **category metafields** you sync (e.g. **fit notes for “Running” vs “Heels”**, **material blocks** per category).
- **Sample note for your shoe store:** In Shopify (or your source), maintain **category-level** text such as: *“Women’s heels: true-to-size for narrow feet; size up for wide.”* / *“Men’s running: half-size up for long runs.”* The AI uses that **only when the toggle is on** and the product’s category is resolved.

---

## 5. Structured “store voice” (v3 template) — optional mirror

If you use **JUNO structured KB** voice fields (`knowledgeTemplate` v3), these pair with the generic keys in code:

| Field key | Label (from app) | Sample answer (shoe store) |
|-----------|------------------|----------------------------|
| `aiToneHowWeSound` | How should the AI sound? | Warm, concise, **obsessed with fit** — we celebrate **men’s and women’s** styles equally and never talk down about budget vs premium lines. |
| `communicationFormality` | Formality | **Professional but friendly** — “we” and “you,” short paragraphs. |
| `phrasesAndPromisesToAvoid` | Words to avoid | No **guaranteed delivery dates**; no claiming **medical** benefits; don’t promise **restock dates** we haven’t confirmed. |
| `whenWeDoNotKnow` | When unsure | Say we’re **not sure**, offer to **email support** with **order #**, or link to **size chart** and **care guide**. |

---

## 6. Disclaimer

- **Replace** placeholders (brand, URLs, hours, days, carriers) with your **real** data before publishing or embedding.
- **Transactional** answers (order status, tracking, stock) must match **your database / Shopify** at runtime — this file is **policy and copy**, not live data.
- Canonical module list and IDs: **[`docs/req-AI.md`](req-AI.md)** §3, §5–§7.

---

*Generated for: **men’s and women’s shoe** positioning — adjust for your exact catalog and regions.*
