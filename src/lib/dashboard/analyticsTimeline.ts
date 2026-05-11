import {
    addDays,
    addMonths,
    addWeeks,
    addYears,
    format,
    startOfDay,
    startOfMonth,
    startOfWeek,
    startOfYear,
    subDays,
    subMonths,
    subYears,
} from "date-fns"

export type AnalyticsRange = "today" | "7d" | "30d" | "90d" | "12m" | "year" | "all"
export type AnalyticsGrain = "day" | "week" | "month" | "year"

export type AnalyticsWindow = {
    range: AnalyticsRange
    grain: AnalyticsGrain
    since: Date
    until: Date
    labels: string[]
}

export function parseAnalyticsRange(raw: string | null | undefined): AnalyticsRange {
    if (raw === "today" || raw === "7d" || raw === "30d" || raw === "90d" || raw === "12m" || raw === "year" || raw === "all") {
        return raw
    }
    return "30d"
}

export function defaultGrainForRange(range: AnalyticsRange): AnalyticsGrain {
    if (range === "today" || range === "7d" || range === "30d") return "day"
    if (range === "90d") return "week"
    return "month"
}

export function parseAnalyticsGrain(
    raw: string | null | undefined,
    range: AnalyticsRange,
): AnalyticsGrain {
    if (raw === "day" || raw === "week" || raw === "month" || raw === "year") return raw
    return defaultGrainForRange(range)
}

export function startOfBucket(date: Date, grain: AnalyticsGrain): Date {
    if (grain === "day") return startOfDay(date)
    if (grain === "week") return startOfWeek(date, { weekStartsOn: 1 })
    if (grain === "year") return startOfYear(date)
    return startOfMonth(date)
}

export function addBucket(date: Date, grain: AnalyticsGrain): Date {
    if (grain === "day") return addDays(date, 1)
    if (grain === "week") return addWeeks(date, 1)
    if (grain === "year") return addYears(date, 1)
    return addMonths(date, 1)
}

export function bucketLabel(date: Date, grain: AnalyticsGrain): string {
    if (grain === "day") return format(date, "MMM d")
    if (grain === "week") return `Week of ${format(date, "MMM d")}`
    if (grain === "year") return format(date, "yyyy")
    return format(date, "MMM yyyy")
}

export function bucketKey(date: Date, grain: AnalyticsGrain): string {
    return format(startOfBucket(date, grain), "yyyy-MM-dd")
}

export function getAnalyticsWindow(params: {
    range?: string | null
    grain?: string | null
    now?: Date
} = {}): AnalyticsWindow {
    const now = params.now ?? new Date()
    const range = parseAnalyticsRange(params.range)
    const grain = parseAnalyticsGrain(params.grain, range)
    const until = now
    const since =
        range === "today"
            ? startOfDay(now)
            : range === "7d"
              ? subDays(startOfDay(now), 6)
              : range === "30d"
                ? subDays(startOfDay(now), 29)
                : range === "90d"
                  ? subDays(startOfDay(now), 89)
                  : range === "12m"
                    ? subMonths(startOfMonth(now), 11)
                    : range === "year"
                      ? startOfYear(now)
                      : subYears(startOfYear(now), 4)

    const labels: string[] = []
    let cursor = startOfBucket(since, grain)
    const final = startOfBucket(until, grain)
    while (cursor.getTime() <= final.getTime() && labels.length < 400) {
        labels.push(bucketKey(cursor, grain))
        cursor = addBucket(cursor, grain)
    }

    return { range, grain, since, until, labels }
}

export function emptyTimeline<T extends Record<string, number>>(
    labels: string[],
    grain: AnalyticsGrain,
    seed: T,
) {
    return labels.map((key) => ({
        key,
        label: bucketLabel(new Date(`${key}T00:00:00`), grain),
        ...seed,
    }))
}
