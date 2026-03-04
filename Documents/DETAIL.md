## Project Overview

This project JUNO is an **AI-powered communication hub for Shopify-based dropshipping businesses**.
It focuses on fixing the broken, slow, and inconsistent communication that happens:
- **From customer to vendor** (the buyer talking to the Shopify store).
- **From vendor to supplier** (the store owner coordinating with the inventory/fulfilment partner).

The goal is to **automate, standardize, and speed up** these conversations while keeping humans in control for sensitive or high‑risk cases. This document explains the real problems we see in today’s Shopify dropshipping workflows and how our solution addresses them end to end. It is intended as a **high-level narrative and feature breakdown** so a designer can understand the flows and design a clear, compelling standee around them.

---

## The Problem in Shopify Dropshipping

### 1. Fragmented and slow communication
- **Multiple channels**: Customers contact the vendor via email, Shopify chat, social media DMs, WhatsApp, etc., while the vendor talks to suppliers via email, WhatsApp groups, or proprietary portals.
- **No unified view**: A vendor often cannot see, in one place, the full story of an order: customer messages, supplier updates, tracking, refunds, and exceptions.
- **Slow response times**: Vendors manually read every message, look up order data in Shopify or in supplier dashboards, and then type replies. This causes:
  - Delays in replying to customers.
  - Delays in sending instructions to suppliers.
  - Lost sales and poor customer experience.

### 2. High support load and repetitive questions
- Customers repeatedly ask:
  - “Where is my order?”
  - “Can I change my address?”
  - “When will it ship?”
  - “Can I return this item?”
- Vendors must **manually search orders, tracking links, and policies** to answer the same questions again and again.
- During peak periods (sales, holidays), messages spike and vendors cannot keep up, leading to:
  - Unanswered tickets.
  - Angry customers.
  - Negative reviews and chargebacks.

### 3. Miscommunication between vendor and supplier
- Vendors depend on suppliers for:
  - Stock availability and substitutions.
  - Shipping timelines and carrier issues.
  - Order modifications (cancellations, address changes, quantity updates).
  - Returns, refunds, and exchanges.
- Today this is often handled via:
  - Unstructured emails or chats.
  - Messages without clear order references, SKUs, or deadlines.
  - Language barriers and time zone differences.
- This leads to:
  - Wrong items shipped.
  - Late shipments.
  - Failed cancellations or address changes.
  - Confusion about responsibility for refunds or reships.

### 4. No intelligence or prioritization
- All messages look the same in a generic inbox.
- **Critical messages** (fraud risk, legal threats, VIP customers, high‑value orders, very angry customers) are not automatically prioritized.
- Vendors lack:
  - Automated sentiment analysis.
  - Intent detection (e.g., “refund request” vs “simple question”).
  - Smart routing/escalation (e.g., “send this to a human immediately”).

### 5. Lack of consistency and brand tone
- Different team members reply with different wording and policies.
- Emotional messages from customers or suppliers may receive emotional, inconsistent responses.
- There is no system to:
  - Enforce tone of voice.
  - Ensure policy‑correct, legally safe replies.
  - Reuse what worked well in previous successful resolutions.

---

## Our Solution Overview

We introduce a **two-sided AI communication system** tightly integrated with Shopify and the vendor’s suppliers:

- **Side 1: Customer → Vendor**
  - A dedicated AI assistant reads customer messages, understands intent and mood, fetches data from the database (orders, tracking, policies), and proposes or sends consistent replies on behalf of the vendor.

- **Side 2: Vendor → Supplier**
  - A second AI assistant reads vendor-side instructions and system events, understands what must be communicated to suppliers, and generates structured, clear messages into a **dedicated vendor–supplier chat system** named **JUNOCHAT**.

Both sides use **trained AI models** tailored to dropshipping language, policies, and edge cases, with human override options and safety checks.

---

## Customer → Vendor Communication

### 1. Inputs and data sources
For each customer message, our system has access to:
- **Customer message content** (email, chat, social DM, etc.).
- **Shopify data**:
  - Orders linked by email, phone, name, or order ID.
  - Order status (paid, fulfilled, in transit, delivered).
  - Tracking information from carriers.
- **Internal policies**:
  - Refund and return rules.
  - Shipping times and regions.
  - Discount and compensation limits.
- **Knowledge base**:
  - Product FAQs.
  - Size guides, material descriptions, usage instructions.

The system automatically links the incoming message with the most relevant order(s) and context.

### 2. AI model behavior (customer side)
We use a **trained model** that:
- **Detects intent**:
  - Examples: pre‑purchase question, order status request, address change, refund request, cancellation request, complaint, product issue, technical question, generic feedback, spam, etc.
- **Detects mood/sentiment**:
  - Examples: happy, neutral, confused, frustrated, angry, urgent, threatening (legal/chargeback).
- **Understands multi‑turn context**:
  - Reads past messages in the same thread.
  - Respects previous promises made to the customer.

Based on intent + mood + context, the model:
- Fetches required data from the **database** (orders, tracking, policy rules).
- Generates a **draft response** in the vendor’s tone of voice.
- Ensures:
  - Policy compliance (e.g., does not promise unauthorized full refunds).
  - Factual accuracy based on live data (e.g., correct tracking status).

The response can be:
- **Automatically sent** for low‑risk, common cases (e.g., standard “where is my order”).
- **Queued for human review** for higher‑risk or unusual cases (e.g., legal threats, high cart value, repeated complaints).

### 3. Key features for the designer to highlight
- **Unified inbox**: All customer messages from multiple channels appear in one place, enriched with order data.
- **Intent + mood labels**: Each conversation is tagged (e.g., “Refund request – Angry – High priority”).
- **Smart reply suggestions**: The AI proposes ready‑to‑send answers, saving the vendor time.
- **Auto‑actions**:
  - Automatically includes links, tracking numbers, or return instructions.
  - Automatically asks clarifying questions when essential data is missing (e.g., order ID).
- **Brand‑consistent tone**: Replies follow the store’s style (friendly, professional, etc.).

### 4. Edge cases we handle (customer side)
- **No matching order found**:
  - The model asks for additional information (order ID, email) instead of guessing.
- **Multiple possible orders for the same customer**:
  - The system clarifies which order the customer is asking about or summarises all relevant orders clearly.
- **Angry or abusive messages**:
  - Calm, de‑escalating tone.
  - Option to auto‑escalate to a human.
  - Ability to flag for potential fraud or chargeback risk.
- **Language differences**:
  - Automatically detects language and responds in the customer’s language (where configured).
- **Complex policy cases** (e.g., partial refunds, used products, out‑of‑policy requests):
  - AI applies rules and, if unsure, marks for human approval rather than auto‑committing.
- **Time‑critical changes** (cancellation/address change before fulfilment):
  - High‑urgency flag.
  - Passes structured instructions into the vendor → supplier flow (see next section).

---

## Vendor → Supplier Communication

### 1. Core idea
The **vendor → supplier side** ensures that what the customer needs (refunds, reships, changes, information) is translated into **clear, actionable, and timely instructions for suppliers**.

Instead of the vendor writing ad‑hoc emails or chat messages, our system:
- Understands the **vendor’s intent and mood**.
- Converts that into a **structured, standardized message** to the supplier.
- Sends it via a **dedicated vendor–supplier chat system** or the supplier’s preferred channel/integration.

### 2. Inputs and data sources
For each required vendor → supplier communication, we combine:
- **Vendor actions and messages** inside our system:
  - Clicking actions like “request cancellation”, “request reship”, “ask for stock confirmation”.
  - Manual notes or additional comments by the vendor.
- **Customer side context**:
  - What the customer requested.
  - How urgent or time‑sensitive the situation is.
  - Any promises already made to the customer.
- **Order and product data**:
  - Order ID, SKUs, quantities, prices, shipping method.
  - Tracking IDs and previous supplier updates.
- **Supplier configuration**:
  - Time zone and typical response speed.
  - Preferred language.
  - Business rules (MOQs, restocking times, RMA process).

### 3. AI model behavior (vendor side)
We use a **separate AI model** specialized in:
- **Vendor intent + mood detection**:
  - Examples: stock inquiry, urgent cancellation, change of address, reshipment request, quality complaint, bulk pricing discussion, general update.
  - Mood: calm, neutral, urgent, frustrated, high‑severity.
- **Message generation to suppliers**:
  - Converts intent into a clear message that contains:
    - All necessary reference IDs.
    - Clear requests and deadlines.
    - Structured bullet points for actions.
  - Uses suitable tone (firm but professional), regardless of the vendor’s emotional state.
- **Chat system integration**:
  - Automatically posts the generated message into the **dedicated vendor–supplier chat** or connected supplier system.
  - Organizes conversations per order or ticket so everyone sees complete history.

### 4. Key features for the designer to highlight
- **Dedicated vendor–supplier chat**:
  - One place to see all messages to and from each supplier, grouped by order.
- **Automatic message drafting**:
  - Vendor clicks an action (e.g., “request cancellation”) and the system drafts a supplier message with all required details pre‑filled.
- **Structured, unambiguous supplier requests**:
  - No more vague messages like “pls cancel”; instead, clear instructions listing:
    - Order details.
    - Items affected.
    - Requested action (cancel, reship, refund, investigation).
    - Time constraints.
- **Two‑way visibility**:
  - Supplier replies are pulled back into the vendor’s system.
  - Customer‑facing side is updated based on supplier confirmations (e.g., updated ETAs, reship tracking).

### 5. Edge cases we handle (vendor side)
- **Multiple suppliers per order**:
  - The system splits the instructions appropriately and sends them to each relevant supplier.
- **Backorders and out‑of‑stock situations**:
  - Supplier response is interpreted by the AI and reflected back into customer‑facing options (e.g., refund vs alternative product).
- **No response from supplier**:
  - Automated reminders after configurable time windows.
  - Escalation markers for the vendor.
- **Language and time zone differences**:
  - Messages can be localized; scheduling considers supplier local hours.
- **Conflicting information**:
  - If supplier information contradicts existing tracking or data, the system flags it for human review rather than auto‑resolving.
- **Policy alignment**:
  - Ensures requests sent to suppliers remain aligned with vendor’s commitment to customers and legal guidelines.

---

## End-to-End Flow: From Customer Message to Supplier Action

At a high level, the journey works like this:
1. **Customer writes a message** (e.g., “I used the wrong address, please change it”).
2. The **customer-side AI model**:
   - Detects intent (address change) and mood (worried/urgent).
   - Fetches order data and checks fulfilment status.
3. If the order is not yet shipped:
   - The AI replies to the customer, acknowledging the request and explaining the next steps.
   - At the same time, it triggers a **vendor → supplier action** to update the address.
4. The **vendor-side AI model**:
   - Crafts a precise update request to the supplier with the new address and delivery instructions.
   - Sends it through the dedicated vendor–supplier chat.
5. **Supplier responds** (e.g., “address updated successfully” or “too late, package shipped”).
6. The system:
   - Updates internal status.
   - Notifies the customer with an accurate outcome, again via the customer-side AI assistant.

Throughout this flow:
- **All actions are logged and auditable**.
- **Humans can override or adjust AI decisions**.
- **Customers receive quick, consistent, data‑driven replies**.
- **Suppliers receive clear, actionable instructions**, reducing errors and back‑and‑forth.

---

## Vendor Onboarding Journey

This section explains the **actual onboarding flow implemented in JUNO** for a new vendor, based directly on the signup screens, onboarding wizard, and backend routes.

### Step 0: Create a Vendor Account
- The user goes to the signup page and chooses the **VENDOR** role (or signs in with Google where the callback leads to onboarding).
- After registration and login:
  - If the user is a vendor **without any store that has `onboardingComplete = true`**, they are sent to the **multi‑step onboarding wizard** at the `/onboarding` route.
  - If they already have at least one fully onboarded store, they are redirected straight to the **dashboard** instead of seeing onboarding again.

### Step 1: Business Profile (Business Info)
- In the first step of the onboarding wizard, the vendor fills in basic business details:
  - **Business name** (public name of the brand).
  - **Business email** (main contact address).
  - **Country**.
  - **Timezone**.
- This information is stored with the store record and is used to:
  - Pre‑fill communication details.
  - Align timestamps and reporting with the vendor’s local time.

### Step 2: Connect Shopify (Store + Credentials)
- In the second step, the vendor connects their **Shopify store** by entering:
  - **Shopify store name**.
  - **Shopify domain** (e.g., `mystore.myshopify.com`, which the backend cleans and normalizes).
  - **Admin API Key**.
  - **Admin API Secret**.
  - **Admin Access Token**.
- When the vendor clicks the validation button:
  - The client calls the **Shopify validation endpoint** with these values.
  - If required fields (domain and access token) are missing or the credentials are invalid, the UI shows a clear error and **does not proceed to the next step**.
  - On success, the wizard moves the vendor forward, ensuring that only a verified Shopify connection continues in the flow.

### Step 3: Sync & Fulfilment Preferences
- In the third step, the vendor configures preferences that control how JUNO interacts with Shopify and suppliers:
  - **Sync frequency** for pulling Shopify data (options like real‑time, hourly, or daily).
  - A toggle for **automated fulfilment** (whether new orders should be automatically pushed to suppliers).
- These options become part of the onboarding payload so that, when the account is finalized, the backend knows:
  - How aggressively to sync data.
  - Whether to immediately trigger supplier workflows for new orders.

### Step 4: Finalize and Persist Onboarding
- In the final step, the vendor submits all onboarding data:
  - The frontend sends the collected fields (business info, Shopify details, preferences) to the **`/api/onboarding/complete`** endpoint.
- On the backend:
  - The system checks authentication and ensures the user is valid.
  - It validates the critical fields (e.g., business name, domain, access token).
  - It **cleans the Shopify domain** (removing protocol, trailing slashes, and whitespace).
  - It then either:
    - **Updates an existing store** for this user + domain, or
    - **Creates a new store record** if one does not exist yet.
  - The store is saved with:
    - Business name + email.
    - Country + timezone (or sensible defaults).
    - Shopify store name + normalized domain.
    - Admin API key, secret, and access token.
    - Onboarding flags:
      - `onboardingComplete = true`.
      - `isActive` set for the first store.
  - If this is the **first store** for the vendor:
    - The user’s `activeStoreId` is updated to point to this new store.
  - The backend also **registers Shopify webhooks** for events such as:
    - `orders/create` and `orders/updated`.
    - `products/create`, `products/update`, `products/delete`.
  - These webhooks are pointed to the correct app URL so JUNO can receive live updates from Shopify.
- Once the API call succeeds:
  - The UI shows a **“Setup Complete”** screen.
  - The vendor is then redirected to the **dashboard**, where syncing and AI‑driven workflows take over.

### Multi‑Store and Onboarding Checks
- A vendor can have **multiple Shopify stores** under one JUNO account:
  - Each store is stored separately with its own domain, credentials, and `onboardingComplete` flag.
  - Additional store connections use a streamlined Shopify onboarding flow that collects the same core fields and persists another store record.
- The **`/api/onboarding/check`** endpoint is used to:
  - Confirm if a vendor already has at least one fully onboarded store.
  - Skip the onboarding wizard for non‑vendor roles (e.g., suppliers) by immediately marking them as complete.

---

## What the Designer Should Take Away

- **Core message**: We fix broken communication in Shopify dropshipping by using AI on both sides:
  - **Customer → Vendor**: Intelligent support assistant for customer messages.
  - **Vendor → Supplier**: Intelligent coordination assistant for supplier communication.
  - **Vendor Onboarding**: A concrete, four‑step wizard (business profile → Shopify connection → sync/fulfilment preferences → finalize) backed by real API endpoints and webhook setup.
- **Key benefits to visualize**:
  - Faster replies, fewer mistakes, less manual typing.
  - Happier customers (clear answers, faster resolutions).
  - Happier vendors (less support load, more control).
  - Happier suppliers (clear, structured instructions).
- **Feel of the product**:
  - Central, unified communication hub.
  - AI co‑pilot on both ends of the chain.
  - Human‑in‑the‑loop safety for sensitive cases.
  - Smooth onboarding path from day one to full automation.

This document should provide enough depth to design a standee that clearly shows:
- The **two main flows** (customer → vendor and vendor → supplier).
- The **vendor onboarding journey** from connect → configure → automate.
- The **before vs. after** pain points and improvements.
- The **AI‑powered, data‑aware, and automated nature** of the solution.

