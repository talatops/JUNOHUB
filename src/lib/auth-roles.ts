/** Vendor dashboard, Shopify, and supplier-management APIs (excludes supplier portal). */
export function isVendorPortalRole(role: string | null | undefined): boolean {
    return role === "VENDOR" || role === "ADMIN"
}
