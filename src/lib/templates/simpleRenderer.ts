import { logger } from "@/lib/logger"

/** Escape string values injected into HTML email bodies (inbound-derived text). */
export function escapeHtmlForEmail(s: string): string {
    return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")
}

const HTML_ESCAPED_CONTEXT_KEYS = new Set([
    "customer_name",
    "customer_email",
    "subject",
    "ticket_summary",
    "store_name",
    "store_email",
    "order_summary",
])

/** Clone context with HTML-safe string values for isHtml templates. */
export function escapeTemplateContextForHtml(
    context: Record<string, string | number | boolean | null | undefined>
): Record<string, string | number | boolean | null | undefined> {
    const out: Record<string, string | number | boolean | null | undefined> = { ...context }
    for (const key of HTML_ESCAPED_CONTEXT_KEYS) {
        const v = out[key]
        if (typeof v === "string") {
            out[key] = escapeHtmlForEmail(v)
        }
    }
    return out
}

/**
 * Very small, safe renderer for {{variable}} placeholders.
 * - No conditionals or loops
 * - Only replaces {{key}} with string values from context
 */
export function renderTemplate(
    body: string,
    context: Record<string, string | number | boolean | null | undefined>,
): string {
    if (!body) return ""

    // Track missing variables for logging
    const missing = new Set<string>()

    const rendered = body.replace(/{{\s*([a-zA-Z0-9_.-]+)\s*}}/g, (match, key: string) => {
        const value = context[key]
        if (value === null || value === undefined) {
            missing.add(key)
            // Leave the placeholder in place so it's obvious something is missing
            return match
        }
        return String(value)
    })

    if (missing.size > 0) {
        logger.warn("Template rendered with missing variables", {
            missing: Array.from(missing),
        })
    }

    return rendered
}

