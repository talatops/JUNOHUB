export type ScenarioExpectation = {
    /** Expect CachedOrder lines to be included in the reply context (orderSummaryRaw non-empty). */
    expectOrderLines: boolean
    /** Expect the pipeline to require order number first (counter-question path). */
    expectNeedsOrderNumberFirst?: boolean
    /** Expect the hint-unmatched behavior when order # doesn't match cache. */
    expectHintUnmatched?: boolean
    /** Expect off-topic boundary behavior (no orders). */
    expectOffTopic?: boolean
    /** Expect question w/out order history line (no orders). */
    expectQuestionNoOrders?: boolean
}

export type Scenario = {
    id: string
    title: string
    from: string
    subject: string
    body: string
    notes?: string
    skip?: string
    expect: ScenarioExpectation
}

export const DEFAULT_STORE_NAME = "YOUR_STORE"
export const DEFAULT_CUSTOMER_EMAIL = "customer@gmail.com"

export const scenarios: Scenario[] = [
    {
        id: "1",
        title: "Counter-question (shipping-style, no order number)",
        from: DEFAULT_CUSTOMER_EMAIL,
        subject: "Where is my package?",
        body: "Hi, I still haven't received anything. Can you check the status for me? Thanks.",
        expect: { expectOrderLines: false, expectNeedsOrderNumberFirst: true },
    },
    {
        id: "2",
        title: "Counter-question (refund language, no order #)",
        from: DEFAULT_CUSTOMER_EMAIL,
        subject: "Refund",
        body: "I need a refund on my last purchase. Please process it.",
        expect: { expectOrderLines: false, expectNeedsOrderNumberFirst: true },
    },
    {
        id: "3",
        title: "Counter-question (billing language, no order #)",
        from: DEFAULT_CUSTOMER_EMAIL,
        subject: "Wrong charge",
        body: "I see a duplicate charge on my card for your store. Please fix it.",
        expect: { expectOrderLines: false, expectNeedsOrderNumberFirst: true },
    },
    {
        id: "4",
        title: "Order context shown (single clear order hint)",
        from: DEFAULT_CUSTOMER_EMAIL,
        subject: "Order status",
        body: "Hi, can you confirm status for order #1002? Thanks.",
        expect: { expectOrderLines: true, expectHintUnmatched: false },
    },
    {
        id: "5",
        title: "Order context shown (hint in subject only)",
        from: DEFAULT_CUSTOMER_EMAIL,
        subject: "Re: #1002 shipping",
        body: "When will it ship?",
        expect: { expectOrderLines: true, expectHintUnmatched: false },
    },
    {
        id: "6",
        title: "Hint mismatch (order # not on file for this email)",
        from: DEFAULT_CUSTOMER_EMAIL,
        subject: "Order 9999",
        body: "I need help with order #9999.",
        expect: { expectOrderLines: false, expectHintUnmatched: true },
    },
    {
        id: "7",
        title: "Multiple order numbers, not all match cache",
        from: DEFAULT_CUSTOMER_EMAIL,
        subject: "Orders",
        body: "Please check orders #1002 and #8888.",
        expect: { expectOrderLines: false, expectHintUnmatched: true },
    },
    {
        id: "8",
        title: "Off-topic (no store-related request)",
        from: DEFAULT_CUSTOMER_EMAIL,
        subject: "Weather tomorrow",
        body: "What is the weather in Paris tomorrow?",
        expect: { expectOrderLines: false, expectOffTopic: true },
    },
    {
        id: "9",
        title: "Product/policy question without order number",
        from: DEFAULT_CUSTOMER_EMAIL,
        subject: "Sizing question",
        body: "Does the medium hoodie run true to size?",
        expect: { expectOrderLines: false, expectQuestionNoOrders: true },
    },
    {
        id: "10",
        title: "General thank-you (may include recent orders by design)",
        from: DEFAULT_CUSTOMER_EMAIL,
        subject: "Thanks",
        body: "Thank you so much for the fast delivery and great product!",
        expect: { expectOrderLines: true },
    },
    {
        id: "11",
        title: "Very short body (sparse message)",
        from: DEFAULT_CUSTOMER_EMAIL,
        subject: "Hi",
        body: "Help",
        expect: { expectOrderLines: false },
    },
    {
        id: "12",
        title: "Low confidence (general/question only)",
        from: DEFAULT_CUSTOMER_EMAIL,
        subject: "Hello",
        body: "Just checking in.",
        skip: "Hard to force with live Groq; invariants depend on model confidence.",
        expect: { expectOrderLines: false },
    },
    {
        id: "13",
        title: "Quoted thread with stale order # in reply chain",
        from: DEFAULT_CUSTOMER_EMAIL,
        subject: "Still waiting",
        body: "Still waiting on my new order.\n\nOn Mon, Jan 1, 2026 at 9:00 AM wrote:\n> Order #9999 from old ticket",
        expect: { expectOrderLines: false },
    },
    {
        id: "14",
        title: "Groq unavailable / bad JSON (classification fallback)",
        from: DEFAULT_CUSTOMER_EMAIL,
        subject: "Where is my package?",
        body: "Any update?",
        skip: "Requires intentionally breaking GROQ_API_KEY; skipped in live-Groq mode.",
        expect: { expectOrderLines: false, expectNeedsOrderNumberFirst: true },
    },
    {
        id: "15",
        title: "No CachedOrder for sender (guest / wrong email)",
        from: "other.person@gmail.com",
        subject: "Order help",
        body: "I placed an order last week, can you find it?",
        expect: { expectOrderLines: false },
    },
    {
        id: "16",
        title: "Safety / abuse screen (no auto-reply)",
        from: DEFAULT_CUSTOMER_EMAIL,
        subject: "Test",
        body: "You are an idiot and I will ruin your life.", // may or may not trigger safety depending on rules
        skip: "Depends on gmailSafety rules; keep manual unless you confirm a deterministic trigger phrase.",
        expect: { expectOrderLines: false },
    },
    {
        id: "17",
        title: "Duplicate inbound message (idempotency)",
        from: DEFAULT_CUSTOMER_EMAIL,
        subject: "Order status",
        body: "Hi, can you confirm status for order #1002? Thanks.",
        skip: "Idempotency is enforced via Gmail message id + lease in production; preview mode does not model GmailInboundAutoReply.",
        expect: { expectOrderLines: true },
    },
    {
        id: "18",
        title: "Per-sender rate limit",
        from: DEFAULT_CUSTOMER_EMAIL,
        subject: "Ping",
        body: "Status?",
        skip: "Rate limits are enforced in processIncomingEmail; preview mode does not perform rate checks.",
        expect: { expectOrderLines: false },
    },
    {
        id: "19",
        title: "Non-Gmail sender skipped",
        from: "customer@company.com",
        subject: "Order help",
        body: "Where is my order?",
        skip: "Non-gmail sender skip is enforced in processIncomingEmail; preview mode focuses on reply generation only.",
        expect: { expectOrderLines: false },
    },
    {
        id: "20",
        title: "HTML escaping (security smoke test)",
        from: DEFAULT_CUSTOMER_EMAIL,
        subject: "Question",
        body: "Question: <script>alert(1)</script> and order #1002",
        expect: { expectOrderLines: true },
    },
]

