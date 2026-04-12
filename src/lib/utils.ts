import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export function getBaseUrl() {
    if (process.env.AUTH_URL) return process.env.AUTH_URL
    if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL
    if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL
    return "http://localhost:3000"
}

/** Turn a relative `/uploads/...` path into an absolute URL (emails, server-side HTML). */
export function absoluteUrlForPublicPath(path: string | null | undefined): string {
    if (!path?.trim()) return ""
    const p = path.trim()
    if (/^https?:\/\//i.test(p)) return p
    const base = getBaseUrl().replace(/\/$/, "")
    const pathPart = p.startsWith("/") ? p : `/${p}`
    return `${base}${pathPart}`
}

/**
 * Base URL for images embedded in outbound email HTML. Gmail requires a **public HTTPS** URL;
 * prefer `NEXT_PUBLIC_APP_URL` (production) over localhost so `<img src>` resolves for recipients.
 */
export function getEmailAssetBaseUrl(): string {
    if (process.env.NEXT_PUBLIC_APP_URL?.trim()) {
        return process.env.NEXT_PUBLIC_APP_URL.trim().replace(/\/$/, "")
    }
    if (process.env.VERCEL_URL?.trim()) {
        return `https://${process.env.VERCEL_URL.trim()}`.replace(/\/$/, "")
    }
    if (process.env.AUTH_URL?.trim()) {
        return process.env.AUTH_URL.trim().replace(/\/$/, "")
    }
    if (process.env.NEXTAUTH_URL?.trim()) {
        return process.env.NEXTAUTH_URL.trim().replace(/\/$/, "")
    }
    return "http://localhost:3000"
}

/** Use for `<img src>` in Gmail / email bodies (not for in-browser preview). */
export function absoluteUrlForEmailImages(path: string | null | undefined): string {
    if (!path?.trim()) return ""
    const p = path.trim()
    if (/^https?:\/\//i.test(p)) return p
    const base = getEmailAssetBaseUrl()
    const pathPart = p.startsWith("/") ? p : `/${p}`
    return `${base}${pathPart}`
}

/**
 * Client-side preview: same-origin absolute URL so `/uploads/...` images load in img/src and iframes.
 * Server: falls back to absoluteUrlForPublicPath.
 */
export function publicAssetUrlForUi(path: string | null | undefined): string {
    if (!path?.trim()) return ""
    const p = path.trim()
    if (/^https?:\/\//i.test(p)) return p
    if (typeof window !== "undefined") {
        const origin = window.location.origin
        return `${origin}${p.startsWith("/") ? p : `/${p}`}`
    }
    return absoluteUrlForPublicPath(p)
}
