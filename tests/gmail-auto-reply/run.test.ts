import fs from "node:fs/promises"
import path from "node:path"
import { describe, it, expect } from "vitest"
import { generateAutoReplyPreview } from "@/lib/gmail/autoReplyPreview"
import { scenarios, type Scenario } from "./scenarios"

function projectRoot(): string {
    return process.cwd()
}

function artifactsDir(): string {
    return path.join(projectRoot(), "tests", "gmail-auto-reply", "artifacts")
}

function normalizeForContains(html: string): string {
    return html.replace(/\s+/g, " ").toLowerCase()
}

function assertScenarioInvariants(s: Scenario, out: Awaited<ReturnType<typeof generateAutoReplyPreview>>) {
    const html = normalizeForContains(out.html)

    if (s.expect.expectNeedsOrderNumberFirst != null) {
        expect(out.needsOrderNumberFirst, `${s.id}: needsOrderNumberFirst`).toBe(
            s.expect.expectNeedsOrderNumberFirst,
        )
    }

    if (s.expect.expectHintUnmatched != null) {
        expect(out.hintUnmatched, `${s.id}: hintUnmatched`).toBe(s.expect.expectHintUnmatched)
    }

    if (s.expect.expectOffTopic) {
        const isOffTopic = out.classification.intent === "off_topic" || out.offTopicByHeuristic
        expect(isOffTopic, `${s.id}: off_topic`).toBe(true)
    }

    // Order lines presence/absence (raw summary is the safest signal; template HTML varies).
    if (s.expect.expectOrderLines) {
        expect(out.orderSummaryRaw.trim().length, `${s.id}: orderSummaryRaw non-empty`).toBeGreaterThan(0)
    } else {
        expect(out.orderSummaryRaw.trim().length, `${s.id}: orderSummaryRaw empty`).toBe(0)
    }

    // A few “sanity contains” checks for the human-readable copy paths.
    if (s.expect.expectNeedsOrderNumberFirst) {
        expect(html, `${s.id}: counter-question copy present`).toContain("order number")
    }
    if (s.expect.expectHintUnmatched) {
        expect(html, `${s.id}: hint-unmatched copy present`).toContain("could not match")
    }
    if (s.expect.expectQuestionNoOrders) {
        expect(html, `${s.id}: question no-order-history copy present`).toContain("without attaching order history")
    }
    if (s.expect.expectOffTopic) {
        expect(html, `${s.id}: off-topic boundary present`).toContain("unrelated")
    }
}

describe("gmail auto-reply scenarios (preview mode)", () => {
    it("runs scenarios and writes artifacts", async () => {
        const storeId = process.env.TEST_STORE_ID || "test-store"

        const results: Array<{
            id: string
            title: string
            skipped?: string
            output?: unknown
        }> = []

        await fs.mkdir(artifactsDir(), { recursive: true })

        for (const s of scenarios) {
            if (s.skip) {
                results.push({ id: s.id, title: s.title, skipped: s.skip })
                continue
            }

            const out = await generateAutoReplyPreview({
                storeId,
                fromEmail: s.from,
                subject: s.subject,
                body: s.body,
            })

            assertScenarioInvariants(s, out)

            results.push({
                id: s.id,
                title: s.title,
                output: {
                    classification: out.classification,
                    classifySource: out.classifySource,
                    orderHints: out.orderHints,
                    offTopicByHeuristic: out.offTopicByHeuristic,
                    needsOrderNumberFirst: out.needsOrderNumberFirst,
                    hintUnmatched: out.hintUnmatched,
                    lowConfidenceSuppressOrders: out.lowConfidenceSuppressOrders,
                    messageTooSparse: out.messageTooSparse,
                    skipOrderCacheForQuestion: out.skipOrderCacheForQuestion,
                    suppressOrdersOnFallbackClassification: out.suppressOrdersOnFallbackClassification,
                    orderSummaryRaw: out.orderSummaryRaw,
                    orderSummaryForContext: out.orderSummaryForContext,
                    usedFallback: out.usedFallback,
                    chosenTemplateId: out.chosenTemplateId,
                    html: out.html,
                },
            })
        }

        const outPath = path.join(artifactsDir(), "results.json")
        await fs.writeFile(outPath, JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2))
    }, 120_000)
})

