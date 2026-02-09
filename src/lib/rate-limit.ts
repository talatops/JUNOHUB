type RateLimitResult = {
    success: boolean
}

// Simple in-memory sliding window rate limiter per-process.
// This avoids external dependencies while still providing basic protection.
const WINDOW_MS = 60_000 // 1 minute
const MAX_REQUESTS = 10

type Entry = {
    count: number
    windowStart: number
}

const buckets = new Map<string, Entry>()

function getClientIp(req: Request): string {
    const header = req.headers.get("x-forwarded-for")
    if (header) {
        const ip = header.split(",")[0]?.trim()
        if (ip) return ip
    }
    return req.headers.get("x-real-ip") ?? "unknown"
}

export async function applyRateLimit(req: Request, keyPrefix: string): Promise<RateLimitResult> {
    const ip = getClientIp(req)
    const key = `${keyPrefix}:${ip}`
    const now = Date.now()

    const existing = buckets.get(key)

    if (!existing || now - existing.windowStart > WINDOW_MS) {
        buckets.set(key, { count: 1, windowStart: now })
        return { success: true }
    }

    if (existing.count >= MAX_REQUESTS) {
        return { success: false }
    }

    existing.count += 1
    buckets.set(key, existing)
    return { success: true }
}

