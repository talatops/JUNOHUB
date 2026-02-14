"use client"

import React, {
    createContext,
    useContext,
    useEffect,
    useState,
    ReactNode,
} from "react"

type ThemeMode = "default" | "light"

type ThemeContextValue = {
    theme: ThemeMode
    setTheme: (theme: ThemeMode) => void
    toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

function applyTheme(mode: ThemeMode) {
    if (typeof document === "undefined") return

    const root = document.documentElement

    if (mode === "light") {
        root.setAttribute("data-theme", "light")
    } else {
        root.removeAttribute("data-theme")
    }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [theme, setThemeState] = useState<ThemeMode>("default")

    useEffect(() => {
        // Initialize from localStorage or fallback to default
        try {
            const stored = window.localStorage.getItem("juno-theme") as
                | ThemeMode
                | null
            if (stored === "light" || stored === "default") {
                const timer = setTimeout(() => {
                    setThemeState(stored)
                    applyTheme(stored)
                }, 0)
                return () => clearTimeout(timer)
            } else {
                applyTheme("default")
            }
        } catch {
            applyTheme("default")
        }
    }, [])

    const setTheme = (mode: ThemeMode) => {
        setThemeState(mode)
        try {
            window.localStorage.setItem("juno-theme", mode)
        } catch {
            // ignore storage errors
        }
        applyTheme(mode)
    }

    const toggleTheme = () => {
        setTheme(theme === "default" ? "light" : "default")
    }

    return (
        <ThemeContext.Provider
            value={{
                theme,
                setTheme,
                toggleTheme,
            }}
        >
            {children}
        </ThemeContext.Provider>
    )
}

export function useTheme() {
    const ctx = useContext(ThemeContext)
    if (!ctx) {
        throw new Error("useTheme must be used within a ThemeProvider")
    }
    return ctx
}

