import { describe, expect, it } from "vitest"
import { looksLikeOffTopic, looksLikeSensitiveOrderTopic } from "./gmailOrderDisclosure"

describe("looksLikeSensitiveOrderTopic", () => {
    it("detects shipping and refund language", () => {
        expect(looksLikeSensitiveOrderTopic("Where is my package?")).toBe(true)
        expect(looksLikeSensitiveOrderTopic("I need a refund")).toBe(true)
        expect(looksLikeSensitiveOrderTopic("Wrong charge on my card")).toBe(true)
    })

    it("returns false for vague thanks", () => {
        expect(looksLikeSensitiveOrderTopic("Thanks so much!")).toBe(false)
        expect(looksLikeSensitiveOrderTopic("Hello")).toBe(false)
    })
})

describe("looksLikeOffTopic", () => {
    it("detects obvious non-store topics", () => {
        expect(looksLikeOffTopic("Hey, what's the weather in Islamabad?")).toBe(true)
        expect(looksLikeOffTopic("Can you tell me today's news headlines?")).toBe(true)
    })

    it("does not trigger on store-ish questions", () => {
        expect(looksLikeOffTopic("Where is my package?")).toBe(false)
        expect(looksLikeOffTopic("I need a refund for order #1002")).toBe(false)
    })
})
