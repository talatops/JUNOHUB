import { describe, expect, it } from "vitest"
import {
    decodeHtmlEntities,
    normalizeSubject,
    parseTicketId,
} from "@/lib/tickets/emailLogTickets"

describe("emailLog ticket helpers", () => {
    it("normalizes nested reply prefixes", () => {
        expect(normalizeSubject("Re: Fwd: re: Shipping delay")).toBe("Shipping delay")
    })

    it("decodes html entities in previews", () => {
        expect(decodeHtmlEntities("Tom &amp; Jerry &#39;hello&#39;")).toBe(
            "Tom & Jerry 'hello'",
        )
    })

    it("parses ticket id into email and root subject", () => {
        expect(parseTicketId("customer@example.com::Order 1002")).toEqual({
            customerEmail: "customer@example.com",
            rootSubject: "Order 1002",
        })
        expect(parseTicketId("invalid")).toBeNull()
    })
})
