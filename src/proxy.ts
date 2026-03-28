import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server"
import { auth as vendorAuth } from "@/auth.vendor"
import { auth as supplierAuth } from "@/auth.supplier"

function roleSessionCookiesPresent(req: NextRequest) {
    const supplierCookie =
        req.cookies.get("authjs.session-token-supplier")?.value ??
        req.cookies.get("__Secure-authjs.session-token-supplier")?.value
    const vendorCookie =
        req.cookies.get("authjs.session-token-vendor")?.value ??
        req.cookies.get("__Secure-authjs.session-token-vendor")?.value
    return { supplierCookie, vendorCookie }
}

function selectAuthForRequest(req: NextRequest) {
    const { pathname } = req.nextUrl
    const isDashboard = pathname.startsWith("/dashboard")
    const isSupplier = pathname.startsWith("/supplier")
    const isAuthPage = pathname === "/login" || pathname === "/signup"
    const roleFromQuery = req.nextUrl.searchParams.get("role")?.toUpperCase()

    // When the URL clearly indicates the portal, prefer that role.
    if (isSupplier) return supplierAuth
    if (isDashboard) return vendorAuth

    // On auth pages, respect explicit role query if present.
    if (isAuthPage) {
        if (roleFromQuery === "SUPPLIER") return supplierAuth
        if (roleFromQuery === "VENDOR") return vendorAuth
    }

    // For role-agnostic pages like `/login`, `/signup`, `/onboarding`,
    // choose the auth instance based on which role cookie exists.
    const { supplierCookie, vendorCookie } = roleSessionCookiesPresent(req)
    if (supplierCookie) return supplierAuth
    if (vendorCookie) return vendorAuth

    // Default fallback: vendor.
    return vendorAuth
}

export default function middleware(req: NextRequest, ev: NextFetchEvent) {
    const auth = selectAuthForRequest(req)

    type Role = "SUPPLIER" | "VENDOR"
    type ReqWithAuth = {
        auth?: { user?: { role?: Role } }
        nextUrl: URL
    }

    // NextAuth's `auth()` typing in middleware differs between versions/framework integrations.
    // Cast to the wrapper shape we use at runtime: auth((req) => NextResponse)(req).
    const authAsMiddlewareWrapper = auth as unknown as (fn: (req: unknown) => NextResponse) => (req: NextRequest) => NextResponse

    return authAsMiddlewareWrapper((innerReq: unknown) => {
        const { auth: innerAuth, nextUrl } = innerReq as ReqWithAuth
        const isLoggedIn = !!innerAuth
        const { pathname } = nextUrl
        const userRole = innerAuth?.user?.role

        const isDashboard = pathname.startsWith("/dashboard")
        const isSupplier = pathname.startsWith("/supplier")
        const isOnboarding = pathname === "/onboarding"
        const isAuthPage = pathname === "/login" || pathname === "/signup"

        // Simple auth protection
        if ((isDashboard || isSupplier || isOnboarding) && !isLoggedIn) {
            return NextResponse.redirect(new URL("/login", nextUrl))
        }

        // Role-based routing
        if (isLoggedIn) {
            if (isAuthPage) {
                // Redirect to appropriate dashboard based on role
                if (userRole === "SUPPLIER") {
                    return NextResponse.redirect(new URL("/supplier", nextUrl))
                }
                return NextResponse.redirect(new URL("/dashboard", nextUrl))
            }

            // Prevent suppliers from accessing vendor dashboard
            if (isDashboard && userRole === "SUPPLIER") {
                return NextResponse.redirect(new URL("/supplier", nextUrl))
            }

            // Prevent vendors from accessing supplier dashboard
            if (isSupplier && userRole === "VENDOR") {
                return NextResponse.redirect(new URL("/dashboard", nextUrl))
            }
        }

        return NextResponse.next()
    })(req)
}

export const config = {
    matcher: ["/dashboard/:path*", "/supplier/:path*", "/onboarding", "/login", "/signup"],
}
