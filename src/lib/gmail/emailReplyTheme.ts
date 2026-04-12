import { z } from "zod"
import { escapeHtmlForEmail } from "@/lib/templates/simpleRenderer"
import { absoluteUrlForEmailImages } from "@/lib/utils"

const HEX = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/

/** Default look matches legacy hardcoded auto-reply HTML (dark card). */
export const DEFAULT_GMAIL_REPLY_THEME = {
    backgroundColor: "#0b1220",
    cardBackground: "#020617",
    borderColor: "#1f2937",
    headingColor: "#e5e7eb",
    mutedColor: "#9ca3af",
    textColor: "#d1d5db",
    blockquoteBorder: "#6366f1",
    blockquoteBg: "#020617",
    strongColor: "#e5e7eb",
    signatureAccent: "#a5b4fc",
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    logoUrl: null as string | null,
    /** Plain-text lines shown at the bottom of every auto-reply (HTML stripped on save). */
    emailSignature: "",
} as const

export type ResolvedGmailReplyTheme = {
    backgroundColor: string
    cardBackground: string
    borderColor: string
    headingColor: string
    mutedColor: string
    textColor: string
    blockquoteBorder: string
    blockquoteBg: string
    strongColor: string
    signatureAccent: string
    fontFamily: string
    logoUrl: string | null
    emailSignature: string
}

export const GMAIL_REPLY_FONT_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
    {
        value: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        label: "System / Segoe UI",
    },
    {
        value: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
        label: "System UI stack",
    },
    {
        value: "Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
        label: "Inter",
    },
    {
        value: "Poppins, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
        label: "Poppins",
    },
    {
        value: "Montserrat, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
        label: "Montserrat",
    },
    {
        value: "Nunito, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
        label: "Nunito",
    },
]

function sanitizeHexColor(value: unknown, fallback: string): string {
    if (typeof value !== "string") return fallback
    const v = value.trim()
    return HEX.test(v) ? v : fallback
}

function sanitizeLogoUrl(value: unknown): string | null {
    if (typeof value !== "string") return null
    const v = value.trim()
    if (!v) return null
    if (v.startsWith("/") && !v.includes("..")) {
        return v.slice(0, 500)
    }
    try {
        const parsed = new URL(v)
        if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null
        return parsed.toString().slice(0, 500)
    } catch {
        return null
    }
}

const ALLOWED_FONTS = new Set(GMAIL_REPLY_FONT_OPTIONS.map((o) => o.value))

function sanitizeFont(value: unknown, fallback: string): string {
    if (typeof value !== "string") return fallback
    const v = value.trim()
    return ALLOWED_FONTS.has(v) ? v : fallback
}

const MAX_EMAIL_SIGNATURE = 800

function sanitizeEmailSignature(value: unknown): string {
    if (typeof value !== "string") return ""
    const stripped = value.replace(/<[^>]*>/g, "").trim()
    return stripped.slice(0, MAX_EMAIL_SIGNATURE)
}

/**
 * Merge user JSON with defaults; invalid fields fall back safely.
 */
export function parseGmailReplyThemeJson(raw: unknown): ResolvedGmailReplyTheme {
    const d = DEFAULT_GMAIL_REPLY_THEME
    if (raw === null || raw === undefined) {
        return { ...d, logoUrl: null, emailSignature: "" }
    }
    if (typeof raw !== "object" || Array.isArray(raw)) {
        return { ...d, logoUrl: null, emailSignature: "" }
    }
    const o = raw as Record<string, unknown>
    return {
        backgroundColor: sanitizeHexColor(o.backgroundColor, d.backgroundColor),
        cardBackground: sanitizeHexColor(o.cardBackground, d.cardBackground),
        borderColor: sanitizeHexColor(o.borderColor, d.borderColor),
        headingColor: sanitizeHexColor(o.headingColor, d.headingColor),
        mutedColor: sanitizeHexColor(o.mutedColor, d.mutedColor),
        textColor: sanitizeHexColor(o.textColor, d.textColor),
        blockquoteBorder: sanitizeHexColor(o.blockquoteBorder, d.blockquoteBorder),
        blockquoteBg: sanitizeHexColor(o.blockquoteBg, d.blockquoteBg),
        strongColor: sanitizeHexColor(o.strongColor, d.strongColor),
        signatureAccent: sanitizeHexColor(o.signatureAccent, d.signatureAccent),
        fontFamily: sanitizeFont(o.fontFamily, d.fontFamily),
        logoUrl: sanitizeLogoUrl(o.logoUrl),
        emailSignature: sanitizeEmailSignature(o.emailSignature),
    }
}

export const gmailReplyThemeBodySchema = z
    .object({
        backgroundColor: z.string().optional(),
        cardBackground: z.string().optional(),
        borderColor: z.string().optional(),
        headingColor: z.string().optional(),
        mutedColor: z.string().optional(),
        textColor: z.string().optional(),
        blockquoteBorder: z.string().optional(),
        blockquoteBg: z.string().optional(),
        strongColor: z.string().optional(),
        signatureAccent: z.string().optional(),
        fontFamily: z.string().optional(),
        logoUrl: z.string().nullable().optional(),
        emailSignature: z.string().max(MAX_EMAIL_SIGNATURE).optional(),
    })
    .strict()

export type GmailReplyThemeBody = z.infer<typeof gmailReplyThemeBodySchema>

export function resolvedThemeFromBody(body: GmailReplyThemeBody): ResolvedGmailReplyTheme {
    return parseGmailReplyThemeJson(body)
}

function logoBlock(theme: ResolvedGmailReplyTheme): string {
    if (!theme.logoUrl?.trim()) return ""
    const abs = absoluteUrlForEmailImages(theme.logoUrl.trim())
    const src = escapeHtmlForEmail(abs)
    return `<div style="margin:0 0 18px;text-align:center;">
        <img src="${src}" alt="" width="220" style="max-height:48px;max-width:220px;height:auto;object-fit:contain;display:inline-block;border:0;outline:none;" />
    </div>`
}

/** Optional vendor-written footer (plain text, line breaks preserved). */
function vendorSignatureBlock(theme: ResolvedGmailReplyTheme): string {
    const raw = theme.emailSignature?.trim()
    if (!raw) return ""
    const safe = escapeHtmlForEmail(raw).replace(/\r\n|\n/g, "<br/>")
    return `<div style="margin-top:20px;padding-top:18px;border-top:1px solid ${theme.borderColor};color:${theme.mutedColor};font-size:13px;line-height:1.65;font-family:${theme.fontFamily};">
        ${safe}
    </div>`
}

/** L1 replies: custom signature replaces the default "— Store Support (automated)" line. */
function l1ClosingBlock(theme: ResolvedGmailReplyTheme, storeName: string): string {
    if (theme.emailSignature?.trim()) {
        return vendorSignatureBlock(theme)
    }
    return `<p style="margin: 20px 0 0; color: ${theme.mutedColor}; font-size: 13px;">
        — ${escapeHtmlForEmail(storeName)} Support (automated)
    </p>`
}

/** Fallback templates: custom signature replaces "Best regards, … Support". */
function fallbackClosingBlock(
    theme: ResolvedGmailReplyTheme,
    storeName: string,
    topMargin: "0" | "16px",
): string {
    if (theme.emailSignature?.trim()) {
        return vendorSignatureBlock(theme)
    }
    const margin = topMargin === "0" ? "0" : "16px 0 0"
    return `<p style="margin: ${margin}; color: ${theme.headingColor};">
        Best regards,<br/>
        <span style="color: ${theme.signatureAccent};">${escapeHtmlForEmail(storeName)} Support</span>
    </p>`
}

/**
 * Google Fonts stylesheet for non-system stacks so webfonts load in Gmail and other clients that allow &lt;link&gt;.
 */
function googleFontsLinkTag(fontFamily: string): string {
    const ff = fontFamily
    const spec: Array<{ test: (s: string) => boolean; href: string }> = [
        {
            test: (s) => s.includes("Inter,") || s.includes("'Inter'"),
            href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
        },
        {
            test: (s) => s.includes("Poppins,") || s.includes("'Poppins'"),
            href: "https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap",
        },
        {
            test: (s) => s.includes("Montserrat,") || s.includes("'Montserrat'"),
            href: "https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap",
        },
        {
            test: (s) => s.includes("Nunito,") || s.includes("'Nunito'"),
            href: "https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700&display=swap",
        },
    ]
    for (const { test, href } of spec) {
        if (test(ff)) {
            return `<link rel="stylesheet" href="${escapeHtmlForEmail(href)}" />`
        }
    }
    return ""
}

/**
 * Wrap fragment in a minimal HTML document so Google Fonts and charset apply. Many clients still fall back to system fonts.
 */
export function wrapGmailHtmlDocument(bodyFragment: string, theme: ResolvedGmailReplyTheme): string {
    const fontLink = googleFontsLinkTag(theme.fontFamily)
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
${fontLink}
</head>
<body style="margin:0;padding:0;">
${bodyFragment}
</body>
</html>`
}

/**
 * Sample outbound reply for the vendor preview (same structure as L1 wrapper).
 */
export function buildGmailReplyDemoHtml(storeName: string, theme?: ResolvedGmailReplyTheme): string {
    const t = theme ?? parseGmailReplyThemeJson(null)
    const plain =
        "Thanks for reaching out! Your order #1002 has shipped and should arrive by Friday. " +
        "You can track it from your confirmation email. If you need anything else, just reply to this message."
    return buildL1HtmlEmail(plain, storeName, t)
}

export function buildL1HtmlEmail(
    plainBody: string,
    storeName: string,
    theme?: ResolvedGmailReplyTheme,
): string {
    const t = theme ?? parseGmailReplyThemeJson(null)
    const safe = escapeHtmlForEmail(plainBody).replace(/\r\n|\n/g, "<br/>")
    return `
            <div style="font-family: ${t.fontFamily}; padding: 24px; line-height: 1.6; color: ${t.headingColor}; background-color: ${t.backgroundColor};">
                <div style="max-width: 640px; margin: 0 auto; background: ${t.cardBackground}; border-radius: 16px; border: 1px solid ${t.borderColor}; padding: 24px;">
                    ${logoBlock(t)}
                    <div style="color: ${t.headingColor}; font-size: 15px; white-space: normal;">${safe}</div>
                    ${l1ClosingBlock(t, storeName)}
                </div>
            </div>
        `
}

export function buildMinimalFallbackHtml(
    emailBody: string,
    storeName: string,
    theme?: ResolvedGmailReplyTheme,
): string {
    const t = theme ?? parseGmailReplyThemeJson(null)
    const safeSnippet = escapeHtmlForEmail(emailBody.replace(/<[^>]+>/g, "").slice(0, 400))
    return `
            <div style="font-family: ${t.fontFamily}; padding: 24px; line-height: 1.6; color: ${t.headingColor}; background-color: ${t.backgroundColor};">
                <div style="max-width: 640px; margin: 0 auto; background: ${t.cardBackground}; border-radius: 16px; border: 1px solid ${t.borderColor}; padding: 24px;">
                    ${logoBlock(t)}
                    <h1 style="margin: 0 0 12px; font-size: 20px; color: ${t.headingColor};">Thanks for reaching out</h1>
                    <p style="margin: 0 0 12px; color: ${t.mutedColor};">
                        We have received your message and our team will review it shortly.
                    </p>
                    <p style="margin: 0 0 16px; color: ${t.mutedColor};">Summary of what you sent:</p>
                    <blockquote style="margin: 0 0 20px; padding: 12px 16px; border-left: 3px solid ${t.blockquoteBorder}; background: ${t.blockquoteBg};">
                        <p style="margin: 0; white-space: pre-wrap; color: ${t.textColor}; font-size: 14px;">
${safeSnippet || "No additional message content was detected."}
                        </p>
                    </blockquote>
                    <p style="margin: 0 0 8px; color: ${t.mutedColor};">
                        You can reply to this email if you have more details to share.
                    </p>
                    ${fallbackClosingBlock(t, storeName, "0")}
                </div>
            </div>
        `
}

export function buildNeedOrderIdFallbackHtml(
    storeName: string,
    storeEmail: string,
    theme?: ResolvedGmailReplyTheme,
): string {
    const t = theme ?? parseGmailReplyThemeJson(null)
    const contact = storeEmail.trim()
        ? `Reply with your order number, or email ${storeEmail}.`
        : `Reply with your order number from your confirmation email.`
    return `
            <div style="font-family: ${t.fontFamily}; padding: 24px; line-height: 1.6; color: ${t.headingColor}; background-color: ${t.backgroundColor};">
                <div style="max-width: 640px; margin: 0 auto; background: ${t.cardBackground}; border-radius: 16px; border: 1px solid ${t.borderColor}; padding: 24px;">
                    ${logoBlock(t)}
                    <p style="margin: 0 0 12px; color: ${t.headingColor};">Hello,</p>
                    <p style="margin: 0 0 12px; color: ${t.mutedColor};">
                        We didn&apos;t see an order number in your message. To look up the right order for <strong style="color:${t.strongColor};">${storeName}</strong>,
                        please reply with your order number (for example <strong style="color:${t.strongColor};">#1002</strong> or <strong style="color:${t.strongColor};">1002</strong>) from your order confirmation.
                    </p>
                    <p style="margin: 0; color: ${t.mutedColor};">${contact}</p>
                    ${fallbackClosingBlock(t, storeName, "16px")}
                </div>
            </div>
        `
}

export function buildHintUnmatchedFallbackHtml(
    storeName: string,
    storeEmail: string,
    theme?: ResolvedGmailReplyTheme,
): string {
    const t = theme ?? parseGmailReplyThemeJson(null)
    const contact = storeEmail.trim()
        ? `Reply with the correct order number or email us at ${storeEmail}.`
        : `Reply with the order number from your confirmation email.`
    return `
            <div style="font-family: ${t.fontFamily}; padding: 24px; line-height: 1.6; color: ${t.headingColor}; background-color: ${t.backgroundColor};">
                <div style="max-width: 640px; margin: 0 auto; background: ${t.cardBackground}; border-radius: 16px; border: 1px solid ${t.borderColor}; padding: 24px;">
                    ${logoBlock(t)}
                    <p style="margin: 0 0 12px; color: ${t.headingColor};">Hello,</p>
                    <p style="margin: 0 0 12px; color: ${t.mutedColor};">
                        We could not match the order number in your message to an order on file for <strong style="color:${t.strongColor};">${storeName}</strong> under this email address.
                        Please double-check the number or confirm the email you used when placing the order.
                    </p>
                    <p style="margin: 0; color: ${t.mutedColor};">${contact}</p>
                    ${fallbackClosingBlock(t, storeName, "16px")}
                </div>
            </div>
        `
}

export function buildOffTopicFallbackHtml(
    storeName: string,
    storeEmail: string,
    theme?: ResolvedGmailReplyTheme,
): string {
    const t = theme ?? parseGmailReplyThemeJson(null)
    const contact = storeEmail.trim()
        ? `If you have a question about an order from ${storeName}, reply with details or email us at ${storeEmail}.`
        : `If you have a question about an order from ${storeName}, reply with your question and order number if you have one.`
    return `
            <div style="font-family: ${t.fontFamily}; padding: 24px; line-height: 1.6; color: ${t.headingColor}; background-color: ${t.backgroundColor};">
                <div style="max-width: 640px; margin: 0 auto; background: ${t.cardBackground}; border-radius: 16px; border: 1px solid ${t.borderColor}; padding: 24px;">
                    ${logoBlock(t)}
                    <p style="margin: 0 0 12px; color: ${t.headingColor};">Hello,</p>
                    <p style="margin: 0 0 12px; color: ${t.mutedColor};">
                        This inbox only handles orders, products, shipping, returns, and billing for <strong style="color:${t.strongColor};">${storeName}</strong>.
                        We can&apos;t answer unrelated requests (news, weather, other websites, or general topics).
                    </p>
                    <p style="margin: 0; color: ${t.mutedColor};">${contact}</p>
                    ${fallbackClosingBlock(t, storeName, "16px")}
                </div>
            </div>
        `
}
