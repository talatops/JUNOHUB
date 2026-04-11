import { describe, expect, it } from "vitest"
import {
    buildKnowledgeTemplateStored,
    mergeTemplateAnswers,
    parseKnowledgeTemplateJson,
} from "@/lib/kb/knowledgeTemplate"

describe("knowledgeTemplate v3", () => {
    it("migrates v1 answers into genericAnswers", () => {
        const parsed = parseKnowledgeTemplateJson({
            answers: { brandVoice: "Hello" },
            version: 1,
        })
        expect(parsed?.version).toBe(3)
        expect(parsed?.genericAnswers.aiToneHowWeSound).toContain("Brand voice")
        expect(parsed?.genericAnswers.aiToneHowWeSound).toContain("Hello")
    })

    it("migrates v2 legacyAnswers and drops sharedFields from template shape", () => {
        const parsed = parseKnowledgeTemplateJson({
            version: 2,
            legacyAnswers: { brandVoice: "X" },
            sharedFields: { sf_brand_display_name: "ignored" },
        })
        expect(parsed?.version).toBe(3)
        expect(parsed?.genericAnswers.aiToneHowWeSound).toContain("X")
    })

    it("reads v3 genericAnswers", () => {
        const parsed = parseKnowledgeTemplateJson({
            version: 3,
            genericAnswers: { communicationFormality: "Casual" },
            updatedAt: "2020-01-01",
        })
        expect(parsed?.genericAnswers.communicationFormality).toBe("Casual")
    })

    it("buildKnowledgeTemplateStored normalizes keys", () => {
        const s = buildKnowledgeTemplateStored({
            answers: { aiToneHowWeSound: "  hi  ", unknown: "x" } as Record<string, string>,
        })
        expect(s.genericAnswers.aiToneHowWeSound).toBe("hi")
        expect(s.genericAnswers).not.toHaveProperty("unknown")
    })

    it("mergeTemplateAnswers patches by key", () => {
        const prev = parseKnowledgeTemplateJson({
            version: 3,
            genericAnswers: { aiToneHowWeSound: "a" },
        })
        const s = mergeTemplateAnswers(prev, { whenWeDoNotKnow: "b" })
        expect(s.genericAnswers.aiToneHowWeSound).toBe("a")
        expect(s.genericAnswers.whenWeDoNotKnow).toBe("b")
    })

    it("mergeTemplateAnswers clears when empty string sent for key", () => {
        const prev = parseKnowledgeTemplateJson({
            version: 3,
            genericAnswers: { aiToneHowWeSound: "a" },
        })
        const s = mergeTemplateAnswers(prev, { aiToneHowWeSound: "  " })
        expect(s.genericAnswers.aiToneHowWeSound).toBeUndefined()
    })
})
