type RateLimitResult = {
    success: boolean
}

export type RateLimitOptions = {
    /** Window length in ms (default 60_000). */
    windowMs?: number
    /** Max requests per window per IP (default 10). */
    maxRequests?: number
}

// Simple in-memory sliding window rate limiter per-process.
// This avoids external dependencies while still providing basic protection.
const DEFAULT_WINDOW_MS = 60_000 // 1 minute
const DEFAULT_MAX_REQUESTS = 10

type Entry = {
    count: number
    windowStart: number
    windowMs: number
    maxRequests: number
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

/**
 * Sliding-window rate limit by client IP. Key includes window/max so presets do not share wrong counters.
 */
export async function applyRateLimit(
    req: Request,
    keyPrefix: string,
    options?: RateLimitOptions,
): Promise<RateLimitResult> {
    const windowMs = options?.windowMs ?? DEFAULT_WINDOW_MS
    const maxRequests = options?.maxRequests ?? DEFAULT_MAX_REQUESTS
    const ip = getClientIp(req)
    const key = `${keyPrefix}:w${windowMs}:m${maxRequests}:${ip}`
    const now = Date.now()

    const existing = buckets.get(key)

    if (!existing || now - existing.windowStart > existing.windowMs) {
        buckets.set(key, {
            count: 1,
            windowStart: now,
            windowMs,
            maxRequests,
        })
        return { success: true }
    }

    if (existing.count >= existing.maxRequests) {
        return { success: false }
    }

    existing.count += 1
    buckets.set(key, existing)
    return { success: true }
}

