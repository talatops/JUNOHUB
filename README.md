<p align="center">
  <img src="./public/icon.png" alt="JUNO logo" width="260" />
</p>

<h1 align="center">JUNO</h1>

<p align="center">
  🚀 Modern commerce & AI‑powered support infrastructure for Shopify based dropshipping businesses.
</p>

<p align="center">
  <strong>Tech stack</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-000000?logo=nextdotjs&logoColor=white" alt="Next.js" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/OpenAI-412991?logo=openai&logoColor=white" alt="OpenAI" />
  <img src="https://img.shields.io/badge/Groq-F55036?logo=groq&logoColor=white" alt="Groq" />
  <img src="https://img.shields.io/badge/Gmail%20API-EA4335?logo=gmail&logoColor=white" alt="Gmail API" />
  <img src="https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white" alt="Docker" />
  <img src="https://img.shields.io/badge/NextAuth-000000?logo=nextdotjs&logoColor=white" alt="NextAuth" />
  <img src="https://img.shields.io/badge/Shopify%20API-7AB55C?logo=shopify&logoColor=white" alt="Shopify API" />
  <img src="https://img.shields.io/badge/AES%20Encryption-4B0082" alt="AES Encryption" />
</p>

---

JUNO is a full‑stack Next.js application that powers:

- A **Vendor Portal** for Shopify merchants
- A **Supplier Portal** for product providers
- An **Admin view** for operations
- An AI‑powered helpdesk and knowledge engine called **JUNOCHAT / Juno Engine**

Everything runs inside a single Next.js App Router project (frontend + backend + background jobs). 💻

---

## 📚 Table of Contents

1. [High‑Level Overview](#high-level-overview)
2. [Core Features](#core-features)
   - [Vendor Portal](#vendor-portal)
   - [Supplier Portal](#supplier-portal)
   - [Admin / Ops](#admin--ops)
   - [JUNOCHAT (AI Helpdesk)](#junochat-ai-helpdesk)
3. [Architecture & Tech Stack](#architecture--tech-stack)
4. [Problems & Solutions](#problems--solutions)
5. [Future Enhancements](#future-enhancements)
   - [JUNOCHAT & AI](#future-enhancements-for-junochat--ai)
6. [Local Development](#local-development)
7. [Docker & Deployment](#docker--deployment)
8. [OpenAI, Groq & AI Setup](#openai-groq--ai-setup)
9. [Prisma & Database](#prisma--database)
10. [License](#license)

---

## 🧭 High‑Level Overview

JUNO centralizes communication and operations between **vendors** (Shopify stores) and **suppliers**:

- Vendors can:
  - Connect Shopify stores and sync products.
  - Receive products and price offers from suppliers.
  - See new products in a clean, auto‑refreshing **New Products** view.
  - Get notifications when suppliers change prices or withdraw products.

- Suppliers can:
  - Manage their product catalog with images and pricing.
  - Accept product sync requests from vendors.
  - Provide products and custom pricing per vendor.
  - Edit synced product price/quantity **per vendor** with inline controls.

- Both sides are supported by:
  - **JUNOCHAT** – an AI assistant powered by **OpenAI** (embeddings + chat where configured) and **Groq** (fast chat for storefront widget, Gmail flows, and KB fallback) that can answer questions using the knowledge base, FAQs, and store context.
  - A **Juno Engine** area for Gmail and ticketing workflows.

---

## ✨ Core Features

### 🛍️ Vendor Portal

- **Shopify connections**
  - Connect one or more Shopify stores to JUNO.
  - Webhooks keep orders, inventory, and products in sync.

- **New Products**
  - Consolidated list of:
    - Products vendors requested and had **synced** by suppliers.
    - Products **provided directly** by suppliers via offers.
  - Clean row‑based layout (no heavy cards) that:
    - Auto‑refreshes in the background on an interval and when the tab becomes visible.
    - Avoids UI flicker by only updating when data actually changes.
  - Product detail sheet with:
    - Price
    - Supplier
    - Optional quantity/amount
    - Description and image
  - Clicking outside the detail closes it (no need to aim at a tiny “X”).

- **Suppliers Directory**
  - Discover global suppliers.
  - Send connection invitations.
  - Track connection status (PENDING / CONNECTED / REJECTED).

- **Notifications**
  - Vendors are notified when:
    - A supplier accepts a product sync request.
    - A supplier provides a new product.
    - A supplier updates the price or quantity of an offered/synced product.

### 🤝 Supplier Portal

- **Vendor Connections**
  - Accept invitations using secure tokens.
  - See all connected vendors with status filters.
  - Accept / reject product sync requests from vendors with a dedicated panel.

- **Synced Products Per Vendor**
  - For each vendor, suppliers see a **synced products** block:
    - Compact, scrollable list for large catalogs.
    - Shows image, title, SKU, description.
    - Inline edit controls for:
      - **Price** (for that vendor)
      - **Available amount / quantity** (for that vendor)
  - Updates flow through `ProductSync` so the vendor’s New Products view reflects the new price/amount.

- **Provided Products (Offers)**
  - Suppliers can:
    - Select products from their catalog.
    - Specify **per‑vendor price** and **total quantity**.
    - See all offers in a tidy list with image, SKU, and timestamps.
  - **Edit offer**:
    - Opens a modal (no page jump) to change price and quantity.
    - Sends a notification to the vendor about the update.
  - **Withdraw offer**:
    - Opens a custom confirmation dialog:
      - “You are about to withdraw *{productName}* from *{vendorName}*…”
    - On confirm, removes the offer and the product disappears from the vendor’s New Products list.

- **Products Catalog**
  - Manage own products (create/update/delete).
  - Upload images via:
    - S3 in hosted environments, or
    - Local `public/uploads` in pure local dev.
  - Safeguards:
    - Synced products from vendors are **editable but not deletable**.
    - UI labels clarify when a product is “Synced” and where it came from.

### 🛠️ Admin / Ops

- Admin page with an overview of:
  - Stores
  - Vendors
  - Suppliers
  - Juno Engine activity

- Email‑centric ops:
  - Gmail polling and webhook endpoints.
  - Email logs and templates.
  - MFA setup, notifications, and account hygiene flows.

### 🤖 JUNOCHAT (AI Helpdesk)

JUNOCHAT (a.k.a. Juno Engine chat) is the AI layer that:

- Uses **OpenAI** and **Groq**:
  - **OpenAI** (`text-embedding-3-small`, etc.) for knowledge‑base **embeddings** stored in Postgres/pgvector.
  - **OpenAI** (`gpt-4o-mini` by default, configurable) for **KB “Ask”** answers when `OPENAI_API_KEY` is set.
  - **Groq** for **storefront widget** replies, **Gmail** classification/safety/preview flows, and **KB fallback** if OpenAI chat fails.
- Supports:
  - FAQ ingestion and retrieval.
  - Knowledge document upload + chunking.
  - RAG‑style responses for store‑specific questions (orders, products, policies, etc.).
- Integrates with the rest of JUNO:
  - Can respond based on vendor/supplier context.
  - Ties into the Juno Engine Gmail / ticketing workflow so AI can assist with replies.

---

## Future Enhancements

### Future Enhancements for JUNOCHAT & AI

- **Deeper Shopify awareness**
  - Let JUNOCHAT answer questions like:
    - “Which supplier provides the top‑selling items in the last 30 days?”
    - “What is the margin per vendor on synced products?”

- **Multi‑channel support**
  - Extend Juno Engine beyond Gmail:
    - WhatsApp / SMS
    - Messenger / Instagram DMs
    - Shopify Inbox

- **Active suggestion engine**
  - Use embeddings + usage data to:
    - Suggest products suppliers should offer to specific vendors.
    - Recommend pricing bands per market/region.

- **Self‑service playbooks**
  - Let admins define reusable “AI playbooks”, e.g.:
    - “Handle delayed shipment” flow.
    - “Out‑of‑stock product” flow.
  - JUNOCHAT would follow these playbooks when generating replies.

---

## Architecture & Tech Stack

- **Framework**: Next.js (App Router, TypeScript)
- **UI**: React + Tailwind‑style utility classes
- **Auth**: NextAuth
- **Database**: PostgreSQL via Prisma ORM
- **Background / Integrations**:
  - Gmail APIs (OAuth)
  - Shopify APIs (orders, products, inventory)
  - OpenAI (embeddings + optional chat) and Groq (chat / classification)
- **Deployment**: Docker + GitHub Actions → AWS EC2

---

## Problems & Solutions

### 1. Dropshipping is glued together with spreadsheets and chats 😵‍💫

**Typical Shopify dropshipping today:**

- Vendors discover suppliers in WhatsApp groups, email threads, or random marketplaces.
- Product info, pricing, and availability live in:
  - Google Sheets
  - Excel files
  - Long chat histories and voice notes
- When something changes (price increases, product discontinued), it’s easy to miss and very hard to trace.

**How JUNO helps:**

- Formal **connections** between Shopify stores and suppliers.
- Structured models (`ProductSync`, `SupplierProductOffer`) instead of ad‑hoc spreadsheets.
- Every new product or change becomes:
  - A record in the database.
  - A visible entry in the **New Products** list.
  - A notification to the affected party (vendor or supplier).

👉 Result: less “Did you see my message?” and more “The system already updated this.”  

### 2. No single source of truth for cost, price, and margin per vendor 💸

**In a typical Shopify setup:**

- Supplier sends a Google Sheet with “latest prices”.
- Vendor copies that into Shopify, maybe with manual mark‑ups.
- If the supplier changes cost for **one** vendor, everyone else may still see old prices.
- Nobody is sure what the **current agreed cost** is for a given product/vendor pair.

**How JUNO helps:**

- Suppliers manage **per‑vendor offers** directly in the Supplier Portal:
  - Price and quantity are editable inline.
  - Synced products from vendors can be overridden per store.
- Vendors see the resulting price and available amount in one place:
  - The **New Products** page, refreshed in the background.
  - Notifications whenever suppliers change price/quantity.

👉 Result: vendors always see the latest cost per product per supplier, and suppliers stay in control of what each partner gets.  

### 3. Operational noise across email, tickets, and knowledge 💬

**Pain today:**

- Support lives in Gmail, while operations live in Shopify, and documentation is buried in Notion/Docs.
- Agents manually copy/paste order IDs, tracking links, and policy snippets into replies.
- Repeated questions (“Where is my order?”, “What’s your return policy?”) steal time from real issues.

**How JUNO helps:**

- **JUNOCHAT + Juno Engine**:
  - Ingest FAQs and internal docs into a vectorized knowledge base (via OpenAI embeddings).
  - Answer questions using **RAG** against that knowledge.
  - Integrate with Gmail so tickets and AI context live in the same place.

👉 Result: fewer repetitive replies, faster accurate responses, and a single surface for “what we know” + “what customers ask”.  

---

## Local Development

1. **Install dependencies**

```bash
npm install
```

2. **Create `.env`**

Copy `.env.example` (or the variables listed below) into a local `.env` file and fill in your own values:

- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASSWORD`
- `OPENAI_API_KEY` (embeddings + KB chat; optional `OPENAI_CHAT_MODEL`, `OPENAI_EMBEDDING_MODEL`, `OPENAI_EMBEDDING_DIMENSIONS`)
- `GROQ_API_KEY` (storefront chat, Gmail AI helpers, KB chat fallback; optional `GROQ_MODEL`)
- `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_REGION` (if you use S3 or other AWS services—not required for AI-only local dev)
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`

> Never commit real secrets; `.env*` files are ignored by git.

3. **Run the dev server**

```bash
npm run dev
```

Visit `http://localhost:3000` in your browser.

---

## Docker & Deployment

The project can be run via Docker using the provided `Dockerfile` and `docker-compose.yml`.

Typical pattern:

```bash
docker compose up -d --build
```

Make sure your `.env` is present next to the app code so the container can read it.

### CI/CD on AWS EC2

This repo includes a GitHub Actions workflow at `.github/workflows/deploy-ec2.yml` that:

1. Runs on pushes to the `main` branch.
2. Installs dependencies and builds the Next.js app.
3. SSHes into an EC2 instance.
4. Writes an `.env` file on the EC2 instance from a **single GitHub secret** `EC2_ENV`.
5. Uses `docker compose` / `docker-compose` to build and run the app.
6. Performs a health check and **automatically rolls back** to the previous commit if the deployment or health check fails.

#### Required GitHub Secrets

Set the following secrets in **GitHub → Settings → Secrets and variables → Actions**:

- `EC2_HOST` – public IP or DNS of the EC2 instance.
- `EC2_USER` – SSH user (e.g. `ubuntu`).
- `EC2_SSH_KEY` – private SSH key for that user.
- `EC2_SSH_PORT` – (optional) port, defaults to `22` if not set.
- `EC2_ENV` – **multi-line secret containing the full contents of the `.env` file** used in production.  
  This is written to `.env` on the server during deployment.

#### Deployment Flow

- Push to `main`.
- GitHub Actions:
  - Builds the app.
  - Connects to EC2.
  - Writes `.env` from `EC2_ENV`.
  - Runs `docker compose up -d --build`.
  - Hits the health check URL (by default `http://localhost:3000/api/health`).
- If the health check fails, the workflow:
  - Resets the repo on EC2 to the previous commit.
  - Re-runs `docker compose up -d --build`.

This gives you a sharp deployment with an automatic rollback path.

---

## OpenAI, Groq & AI Setup

### OpenAI (embeddings + KB answers)

1. Create an API key in the [OpenAI dashboard](https://platform.openai.com/).
2. Add to `.env`:

```bash
OPENAI_API_KEY="sk-..."
# Optional overrides:
# OPENAI_EMBEDDING_MODEL="text-embedding-3-small"
# OPENAI_EMBEDDING_DIMENSIONS="1024"
# OPENAI_CHAT_MODEL="gpt-4o-mini"
```

Embeddings are used when indexing knowledge documents, FAQs, and the structured store profile. KB **Ask** uses OpenAI chat first, then falls back to Groq.

### Groq (storefront chat, Gmail helpers, KB fallback)

1. Create an API key at [Groq Console](https://console.groq.com/).
2. Add to `.env`:

```bash
GROQ_API_KEY="gsk_..."
# Optional: GROQ_MODEL="llama-3.1-8b-instant"
```

### Database migration & re‑embedding

1. Apply Prisma migrations:

```bash
npx prisma migrate deploy
```

2. After changing embedding provider or dimensions, re‑embed:

```bash
npm run re-embed-knowledge-base
```

This regenerates vectors and tags chunk metadata with `provider: openai` (required for KB similarity search filters).

---

## Prisma & Database

To inspect the database locally:

```bash
export DATABASE_URL='<YOUR_DB_URL>'
npx prisma studio
```

---

## License

Private / All rights reserved unless explicitly stated otherwise.
