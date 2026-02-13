import { logger } from "@/lib/logger"

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

