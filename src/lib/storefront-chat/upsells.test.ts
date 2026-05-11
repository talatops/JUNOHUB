import { describe, expect, it } from "vitest"
import { parseAiUpsellChoice, rankAutomaticUpsellCandidates } from "./upsells"

describe("automatic storefront upsells", () => {
    it("shortlists cartable active products without the base product", () => {
        const results = rankAutomaticUpsellCandidates({
            baseProduct: {
                productId: "base-1",
                title: "Base Product",
                variantId: "v-base",
                productType: "Main",
            },
            query: "Tell me about the base product",
            candidates: [
                {
                    shopifyProductId: "base-1",
                    title: "Base Product",
                    productType: "Main",
                    status: "active",
                    variants: [{ id: "v-base", title: "Default Title", inventory_quantity: 5 }],
                },
                {
                    shopifyProductId: "candidate-1",
                    title: "Candidate Product",
                    productType: "Accessory",
                    status: "active",
                    variants: [{ id: "v-candidate", title: "Default Title", inventory_quantity: 8, price: "5.00" }],
                },
                {
                    shopifyProductId: "draft-1",
                    title: "Draft Product",
                    productType: "Accessory",
                    status: "draft",
                    variants: [{ id: "v-draft", title: "Default Title", inventory_quantity: 8 }],
                },
            ],
        })

        expect(results).toHaveLength(1)
        expect(results[0].productId).toBe("candidate-1")
        expect(results[0].variantId).toBe("v-candidate")
    })

    it("returns no upsell when the AI chooses null", () => {
        const result = parseAiUpsellChoice(
            JSON.stringify({
                productId: null,
                relationshipType: "uncertain",
                confidence: 0,
                catalogEvidence: "",
                reason: "No clearly complementary product.",
            }),
            [
                {
                    title: "Candidate Product",
                    productType: "Accessory",
                    details: null,
                    product: {
                        productId: "candidate-1",
                        title: "Candidate Product",
                        variantId: "v-candidate",
                    },
                },
            ],
        )

        expect(result).toBeNull()
    })

    it("rejects AI choices marked as substitutes", () => {
        const result = parseAiUpsellChoice(
            JSON.stringify({
                productId: "candidate-1",
                relationshipType: "substitute",
                confidence: 0.9,
                catalogEvidence: "Candidate Product",
                reason: "This is an alternative, not an add-on.",
            }),
            [
                {
                    title: "Candidate Product",
                    productType: "Same Category",
                    details: null,
                    product: {
                        productId: "candidate-1",
                        title: "Candidate Product",
                        variantId: "v-candidate",
                    },
                },
            ],
        )

        expect(result).toBeNull()
    })

    it("accepts high-confidence complementary AI choices", () => {
        const result = parseAiUpsellChoice(
            JSON.stringify({
                productId: "candidate-1",
                relationshipType: "complementary_accessory",
                confidence: 0.95,
                catalogEvidence: "Accessory",
                reason: "This is used together with the base product.",
            }),
            [
                {
                    title: "Candidate Product",
                    productType: "Accessory",
                    details: null,
                    product: {
                        productId: "candidate-1",
                        title: "Candidate Product",
                        variantId: "v-candidate",
                    },
                },
            ],
        )

        expect(result?.productId).toBe("candidate-1")
    })

    it("only accepts AI choices that exist in the candidate list", () => {
        const result = parseAiUpsellChoice(
            JSON.stringify({
                productId: "unknown-product",
                relationshipType: "complementary_accessory",
                confidence: 0.9,
                catalogEvidence: "Accessory",
                reason: "Not in the provided list.",
            }),
            [
                {
                    title: "Candidate Product",
                    productType: "Accessory",
                    details: null,
                    product: {
                        productId: "candidate-1",
                        title: "Candidate Product",
                        variantId: "v-candidate",
                    },
                },
            ],
        )

        expect(result).toBeNull()
    })

    it("rejects complementary choices without exact catalog evidence", () => {
        const result = parseAiUpsellChoice(
            JSON.stringify({
                productId: "candidate-1",
                relationshipType: "complementary_accessory",
                confidence: 0.95,
                catalogEvidence: "commonly worn together",
                reason: "This uses generic knowledge instead of catalog text.",
            }),
            [
                {
                    title: "Plain Socks",
                    productType: "Accessory",
                    details: null,
                    product: {
                        productId: "candidate-1",
                        title: "Plain Socks",
                        variantId: "v-candidate",
                    },
                },
            ],
        )

        expect(result).toBeNull()
    })
})
