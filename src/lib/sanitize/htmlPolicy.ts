/**
 * HTML / rich-text policy (JUNOHUB)
 *
 * - **User-supplied HTML** (KB HTML mode, product body_html previews, rich email bodies):
 *   Prefer storing as-is only when rendered through a strict sanitizer in a follow-up.
 *   For email footers and any interpolated user strings, use `escapeHtmlText` from `./escapeHtml`.
 * - **Widget script** (`src/app/api/stores/[storeId]/route.ts`):
 *   Branding strings are sanitized server-side (`sanitizeShortText`, `sanitizeColor`, JSON-stringified in script).
 *   Header title/tagline are applied with `textContent` in the injected script (not HTML concatenation).
 *
 * @packageDocumentation
 */

export { escapeHtmlText } from "./escapeHtml"
