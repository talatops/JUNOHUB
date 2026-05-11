import { describe, expect, it } from "vitest"
import { classifyAiResolution, classifyCustomerSentiment } from "./aiEvents"

describe("AI analytics event classifiers", () => {
    it("keeps low-confidence sentiment conservative", () => {
        expect(classifyCustomerSentiment("Do you have waterproof boots?")).toBe("neutral")
    })

    it("detects negative and urgent customer messages", () => {
        expect(classifyCustomerSentiment("My parcel is missing and I want a refund")).toBe("negative")
        expect(classifyCustomerSentiment("This is urgent and I need help immediately")).toBe("urgent")
    })

    it("classifies AI escalation and unresolved replies", () => {
        expect(classifyAiResolution({ content: "A human will follow up", module: "HUMAN_ESCALATION" })).toBe(
            "escalated",
        )
        expect(classifyAiResolution({ content: "I could not find that information right now." })).toBe(
            "needs_follow_up",
        )
        expect(classifyAiResolution({ content: "Yes, this product is available in black." })).toBe(
            "resolved_by_ai",
        )
    })
})
