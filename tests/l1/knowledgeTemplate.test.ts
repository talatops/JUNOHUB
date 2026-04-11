import { describe, expect, it } from "vitest"
import {
    parseKnowledgeTemplateJson,
    buildKnowledgeTemplateStored,
} from "@/lib/kb/knowledgeTemplate"

describe("parseKnowledgeTemplateJson", () => {
    it("migrates v1 answers into legacyAnswers", () => {
        const parsed = parseKnowledgeTemplateJson({
            version: 1,
            answers: { brandVoice: "  Hello  " },
            misc: "x",
            updatedAt: "2020-01-01",
        })
        expect(parsed?.version).toBe(2)
        expect(parsed?.legacyAnswers.brandVoice).toBe("Hello")
        expect(parsed?.sharedFields).toEqual({})
        expect(parsed?.misc).toBe("x")
    })

    it("reads v2 sharedFields", () => {
        const parsed = parseKnowledgeTemplateJson({
            version: 2,
            legacyAnswers: {},
            sharedFields: { sf_brand_display_name: "Acme" },
            updatedAt: "2020-01-01",
        })
        expect(parsed?.sharedFields.sf_brand_display_name).toBe("Acme")
    })
})

describe("buildKnowledgeTemplateStored", () => {
    it("builds v2 payload", () => {
        const s = buildKnowledgeTemplateStored({
            answers: { brandVoice: "a" },
            sharedFields: { sf_brand_display_name: "b" },
            misc: "c",
        })
        expect(s.version).toBe(2)
        expect(s.legacyAnswers.brandVoice).toBe("a")
        expect(s.sharedFields.sf_brand_display_name).toBe("b")
        expect(s.misc).toBe("c")
    })
})
