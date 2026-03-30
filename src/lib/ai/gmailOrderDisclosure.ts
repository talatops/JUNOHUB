/**
 * Conservative heuristics for when auto-replies should not assume a specific order
 * without an explicit order number (complements Groq intent classification).
 */

/** Phrases suggesting shipping, refund, or billing — used when classifier fails or returns `general`. */
export function looksLikeSensitiveOrderTopic(text: string): boolean {
    const t = text.toLowerCase()
    if (t.length < 3) return false

    const checks: RegExp[] = [
        /\bwhere\s+is\s+my\s+(order|package|shipment|parcel|stuff)\b/,
        /\bwhen\s+will\s+(my\s+)?(order|package|shipment)\b/,
        /\b(haven'?t|didn'?t)\s+receive(d)?\b.*\b(order|package|item|anything)\b/,
        /\btrack(ing)?\s*(number|link|info|details)?\b/,
        /\b(lost|missing|late|delayed)\s+(package|shipment|order|delivery)\b/,
        /\b(package|order)\s+(not\s+)?(arrived|come|delivered|here|yet)\b/,
        /\bshipping\s+(status|update|delay|problem)\b/,
        /\brefund\b/,
        /\b(return|returned)\s+(this|my|the|item|order)\b/,
        /\breturn\s+policy\b/,
        /\bmoney\s+back\b/,
        /\bcharge\s*back\b/,
        /\b(wrong|duplicate|unauthorized)\s+charge\b/,
        /\b(billing|invoice|payment)\s+(issue|problem|question|dispute)\b/,
        /\bcharged\s+twice\b/,
    ]
    return checks.some((re) => re.test(t))
}

/**
 * Obvious non-store topics that should route to `off_topic` even when classification fails.
 * Keep conservative; this should not trigger on normal store support emails.
 */
export function looksLikeOffTopic(text: string): boolean {
    const t = text.toLowerCase()
    if (t.length < 3) return false

    const checks: RegExp[] = [
        /\bweather\b/,
        /\btemperature\b/,
        /\brain\b|\bsnow\b|\bforecast\b/,
        /\bnews\b|\bheadline(s)?\b/,
        /\bpolitic(s|al)?\b|\belection\b/,
        /\bhomework\b|\bmath\b|\bessay\b|\bassignment\b/,
        /\bjoke\b|\bfunny\b|\bmeme\b/,
        /\bstock(s)?\b|\bcrypto\b|\bbitcoin\b/,
        /\bsports?\b|\bscore\b|\bmatch\b/,
        /\brestaurant\b|\bhotel\b|\bflight\b/,
        /\bislamabad\b|\blahore\b|\bkarachi\b|\bparis\b|\blondon\b|\bnew york\b/,
    ]

    return checks.some((re) => re.test(t))
}
