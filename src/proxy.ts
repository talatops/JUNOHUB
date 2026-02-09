import NextAuth from "next-auth"
import authConfig from "./auth.config"
import { NextResponse } from "next/server"

const { auth } = NextAuth(authConfig)

export default auth((req) => {
    const isLoggedIn = !!req.auth
    const { pathname } = req.nextUrl
    const userRole = req.auth?.user?.role

    const isDashboard = pathname.startsWith("/dashboard")
    const isSupplier = pathname.startsWith("/supplier")
    const isOnboarding = pathname === "/onboarding"
    const isAuthPage = pathname === "/login" || pathname === "/signup"

    // Simple auth protection
    if ((isDashboard || isSupplier || isOnboarding) && !isLoggedIn) {
        return NextResponse.redirect(new URL("/login", req.nextUrl))
    }

    // Role-based routing
    if (isLoggedIn) {
        if (isAuthPage) {
            // Redirect to appropriate dashboard based on role
            if (userRole === "SUPPLIER") {
                return NextResponse.redirect(new URL("/supplier", req.nextUrl))
            }
            return NextResponse.redirect(new URL("/dashboard", req.nextUrl))
        }

        // Prevent suppliers from accessing vendor dashboard
        if (isDashboard && userRole === "SUPPLIER") {
            return NextResponse.redirect(new URL("/supplier", req.nextUrl))
        }

        // Prevent vendors from accessing supplier dashboard
        if (isSupplier && userRole === "VENDOR") {
            return NextResponse.redirect(new URL("/dashboard", req.nextUrl))
        }
    }

    return NextResponse.next()
})

export const config = {
    matcher: ["/dashboard/:path*", "/supplier/:path*", "/onboarding", "/login", "/signup"],
}
