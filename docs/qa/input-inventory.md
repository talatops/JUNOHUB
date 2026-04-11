# JUNOHUB input inventory matrix (living document)

Columns: **Surface** | **Field / action** | **Type** | **API route** | **Method** | **Risk** | **Test ID** | **Server validation** | **Client validation**

Risk: `L` low, `M` medium, `H` high (PII, public, money, files).

## A. Auth and marketing

| Surface | Field | Type | API | Method | Risk | Test ID | Server | Client |
|---------|-------|------|-----|--------|------|---------|--------|--------|
| login | email, password, mfaCode | string | `/api/auth/login` | POST | H | AUTH-LOGIN | Zod `authLoginSchema` | Basic required |
| signup | name, email, password, role | mixed | `/api/auth/register` | POST | H | AUTH-REG | Zod `authRegisterSchema` | Client `authRegisterSchema.safeParse` + maxLength |
| forgot-password | email | string | `/api/auth/password-reset/request` | POST | M | AUTH-PW-REQ | `emailSchema` + rate limit | email format |
| reset-password | email, password, token | string | `/api/auth/password-reset/reset` | POST | H | AUTH-PW-RESET | Zod | min length UI |
| verify-email | token | string | `/api/auth/verify-email/verify` | POST | M | AUTH-VERIFY | rate limit + handler | — |
| LandingFooter | newsletter email | string | `/api/newsletter/subscribe` | POST | M | NEWS-01 | Zod + rate limit | maxLength 254 + server mirror |

## B. Onboarding

| Surface | Field | Type | API | Method | Risk | Test ID | Server | Client |
|---------|-------|------|-----|--------|------|---------|--------|--------|
| onboarding-client | business name, etc. | string | `/api/onboarding/complete` | POST | H | ONB-01 | Handler checks | required fields |
| shopify onboarding | domain, tokens | string | `/api/onboarding/shopify` | POST | H | ONB-SHOPIFY | Handler | trim |

## C. Vendor dashboard

| Surface | Field | Type | API | Method | Risk | Test ID | Server | Client |
|---------|-------|------|-----|--------|------|---------|--------|--------|
| settings/account | businessName, passwords | string | `/api/settings/account` | PUT | H | SET-ACCT | Zod `accountUpdateSchema` | `accountUpdateSchema` + maxLength + `isStrongPassword` |
| settings/security | MFA toggles | mixed | `/api/settings/mfa/*` | POST | H | SET-MFA | rate limit + handlers | — |
| inventory | sync product | JSON | `/api/products/sync` | POST | M | SYNC-POST | Zod `productSyncRequestSchema` + JSON size cap | supplier selected |
| stores | add store | mixed | `/api/stores` | POST | H | STORE-POST | Handler | — |
| suppliers invite | connectToAllStores | bool | `/api/vendors/suppliers/[id]/invite` | POST | M | INV-POST | authz + handler | — |
| juno-engine templates | name, body, html | string | `/api/juno-engine/templates` | POST | M | TPL-POST | Zod `junoTemplateCreateSchema` | max length |
| KB query | query, topK | string/num | `/api/stores/[id]/kb/query` | POST | M | KB-Q | topK capped | — |
| knowledge-template | JSON | JSON | `/api/stores/[id]/knowledge-template` | PUT | M | KB-TPL | Zod | UI maxLength matches `KNOWLEDGE_TEMPLATE_*_MAX` |
| storefront customize | colors, text | string | `/api/stores/[id]` | PATCH | M | SF-CHAT | Handler | — |
| chat | message, attachment | mixed | `/api/chat/messages` | POST | M | CHAT-POST | Zod + rate limit | max length |
| uploads | logo / images | file | `/api/uploads/*` | POST | H | UPL-01 | MIME/size | accept attr |

## D. Supplier portal

| Surface | Field | Type | API | Method | Risk | Test ID | Server | Client |
|---------|-------|------|-----|--------|------|---------|--------|--------|
| supplier/products | title, price, sku, … | mixed | `/api/supplier/products` | POST | M | SUP-P-POST | Zod `supplierProductCreateSchema` | maxLength mirror |
| supplier/products | edit synced / own | mixed | `/api/supplier/products/[id]` | PUT | M | SUP-P-PUT | Zod `supplierProductUpdateSchema` | maxLength mirror |
| supplier settings | company | string | `/api/supplier/profile` | POST | M | SUP-PROF | Zod `supplierProfileUpsertSchema` | — |
| product sync decision | accept / reject | string | `/api/products/sync/[syncId]` | PUT | M | SYNC-DEC | Zod `productSyncDecisionSchema` | — |
| notifications | mark read | mixed | `/api/notifications` | POST | L | NOTIF-READ | Zod `notificationsMarkReadSchema` | — |
| push | subscribe / unsubscribe | JSON | `/api/notifications/subscribe` | POST/DELETE | M | PUSH-01 | Zod push schemas | browser API |

## E. Admin

| Surface | Field | Type | API | Method | Risk | Test ID | Server | Client |
|---------|-------|------|-----|--------|------|---------|--------|--------|
| admin/* | varies | mixed | `/api/admin/*` | * | H | ADM-* | Per-route auth + validation | role gate |

## F. Public widget

| Surface | Field | Type | API | Method | Risk | Test ID | Server | Client |
|---------|-------|------|-----|--------|------|---------|--------|--------|
| storefront widget | shop, visitorId, content | string | `/api/storefront-chat/messages` | POST | H | SF-W-MSG | Zod + rate limit | length |

## G. Follow-up

- Extend this table for every new form.
- Link failing tests to **Test ID** in PR descriptions when fixing validation bugs.
