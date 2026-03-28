import { describe, expect, it } from "vitest"
import { extractOrderNumberHints, stripQuotedEmailTrailForHints } from "./gmailContext"

describe("stripQuotedEmailTrailForHints", () => {
    it("keeps short message without markers", () => {
        const s = "Where is my package? Order #1002"
        expect(stripQuotedEmailTrailForHints(s)).toContain("1002")
    })

    it("truncates after On ... wrote:", () => {
        const s =
            "Still waiting on order 5001.\n\nOn Mon, Jan 1, 2026 at 10:00 AM Someone wrote:\n> #9999 old thread"
        const out = stripQuotedEmailTrailForHints(s)
        expect(out).toContain("5001")
        expect(out).not.toContain("9999")
    })

    it("truncates after Original Message delimiter", () => {
        const s =
            "Refund for #4400 please\n\n-----Original Message-----\nFrom: x\nSubject: Re: #8800"
        const out = stripQuotedEmailTrailForHints(s)
        expect(out).toContain("4400")
        expect(out).not.toContain("8800")
    })
})

describe("extractOrderNumberHints", () => {
    it("finds hash and order phrases", () => {
        expect(extractOrderNumberHints("Re: #1002 and order 2003")).toEqual(
            expect.arrayContaining(["1002", "2003"]),
        )
    })
})
