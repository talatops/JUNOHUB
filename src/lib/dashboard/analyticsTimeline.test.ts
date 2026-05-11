import { describe, expect, it } from "vitest"
import { bucketKey, emptyTimeline, getAnalyticsWindow } from "./analyticsTimeline"

describe("analyticsTimeline", () => {
    it("defaults 30 day ranges to day grain", () => {
        const window = getAnalyticsWindow({
            range: "30d",
            now: new Date("2026-05-11T12:00:00Z"),
        })
        expect(window.grain).toBe("day")
        expect(window.labels).toHaveLength(30)
    })

    it("buckets weeks from Monday", () => {
        expect(bucketKey(new Date("2026-05-11T12:00:00Z"), "week")).toBe("2026-05-11")
        expect(bucketKey(new Date("2026-05-17T12:00:00Z"), "week")).toBe("2026-05-11")
    })

    it("creates zero-filled rows for every label", () => {
        const rows = emptyTimeline(["2026-05-10", "2026-05-11"], "day", { questions: 0, revenue: 0 })
        expect(rows).toEqual([
            { key: "2026-05-10", label: "May 10", questions: 0, revenue: 0 },
            { key: "2026-05-11", label: "May 11", questions: 0, revenue: 0 },
        ])
    })
})
