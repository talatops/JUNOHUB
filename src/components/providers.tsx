"use client"

import { SessionProvider } from "next-auth/react"
import { Toaster } from "react-hot-toast"
import { ThemeProvider } from "@/components/ThemeProvider"
import { usePathname } from "next/navigation"
import { useMemo } from "react"

export function Providers({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()

    const basePath = useMemo(() => {
        // Prefer portal path when it is explicit.
        if (pathname?.startsWith("/supplier")) return "/api/auth/supplier"
        if (pathname?.startsWith("/dashboard")) return "/api/auth/vendor"

        // For role-agnostic pages (login/signup/home), pick based on existing role-scoped cookies.
        // This keeps `useSession()` and `getSession()` aligned with the active role lane.
        const cookieStr = typeof document !== "undefined" ? document.cookie : ""
        const hasSupplier =
            cookieStr.includes("authjs.session-token-supplier=") ||
            cookieStr.includes("__Secure-authjs.session-token-supplier=")
        const hasVendor =
            cookieStr.includes("authjs.session-token-vendor=") ||
            cookieStr.includes("__Secure-authjs.session-token-vendor=")

        if (hasSupplier) return "/api/auth/supplier"
        if (hasVendor) return "/api/auth/vendor"

        // Default fallback.
        return "/api/auth/vendor"
    }, [pathname])

    return (
        <SessionProvider basePath={basePath}>
            <ThemeProvider>
                {children}
                <Toaster
                    position="top-right"
                    toastOptions={{
                        duration: 4000,
                        style: {
                            background: "rgba(30, 41, 59, 0.95)",
                            color: "#fff",
                            border: "1px solid rgba(255, 255, 255, 0.1)",
                            borderRadius: "12px",
                            backdropFilter: "blur(12px)",
                        },
                        success: {
                            iconTheme: {
                                primary: "#10b981",
                                secondary: "#fff",
                            },
                        },
                        error: {
                            iconTheme: {
                                primary: "#ef4444",
                                secondary: "#fff",
                            },
                        },
                    }}
                />
            </ThemeProvider>
        </SessionProvider>
    )
}

