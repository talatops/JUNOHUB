import { describe, expect, it } from "vitest"
import { rankAutomaticUpsellCandidates } from "./upsells"

describe("automatic storefront upsells", () => {
    it("suggests school socks for school shoes and excludes the base product", () => {
        const results = rankAutomaticUpsellCandidates({
            baseProduct: {
                productId: "shoe-1",
                title: "School Shoes",
                variantId: "v-shoe",
                productType: "Shoes",
            },
            query: "Do you have school shoes?",
            candidates: [
                {
                    shopifyProductId: "shoe-1",
                    title: "School Shoes",
                    productType: "Shoes",
                    status: "active",
                    variants: [{ id: "v-shoe", title: "Default Title", inventory_quantity: 5 }],
                },
                {
                    shopifyProductId: "sock-1",
                    title: "School Socks",
                    productType: "Accessories",
                    status: "active",
                    variants: [{ id: "v-sock", title: "Default Title", inventory_quantity: 8, price: "5.00" }],
                },
                {
                    shopifyProductId: "bag-1",
                    title: "Travel Bag",
                    productType: "Bags",
                    status: "active",
                    variants: [{ id: "v-bag", title: "Default Title", inventory_quantity: 8 }],
                },
            ],
        })

        expect(results).toHaveLength(1)
        expect(results[0].productId).toBe("sock-1")
        expect(results[0].variantId).toBe("v-sock")
    })
})
