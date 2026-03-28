import { describe, expect, it } from "vitest"
import { looksLikeSensitiveOrderTopic } from "./gmailOrderDisclosure"

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
