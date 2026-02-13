"use client"

import { SessionProvider } from "next-auth/react"
import { Toaster } from "react-hot-toast"
import { ThemeProvider } from "@/components/ThemeProvider"

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <SessionProvider>
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

