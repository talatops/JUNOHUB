"use client"

import { useTheme } from "@/components/ThemeProvider"
import { Sun, Moon } from "lucide-react"

export default function ThemeToggle() {
    const { theme, setTheme, toggleTheme } = useTheme()

    const isLight = theme === "light"

    return (
        <div className="flex items-center gap-2">
            <button
                type="button"
                onClick={toggleTheme}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-slate-900/40 px-2.5 py-1 text-[11px] font-medium text-slate-200 hover:bg-white/10"
                aria-label="Toggle theme"
            >
                {isLight ? (
                    <Sun className="h-3.5 w-3.5 text-amber-300" />
                ) : (
                    <Moon className="h-3.5 w-3.5 text-sky-300" />
                )}
                <span>{isLight ? "Light mode" : "Default mode"}</span>
            </button>

            <div className="hidden md:flex rounded-full border border-white/10 bg-slate-900/50 text-[11px] font-semibold text-slate-300 overflow-hidden">
                <button
                    type="button"
                    onClick={() => setTheme("default")}
                    className={`px-2.5 py-1 ${
                        theme === "default"
                            ? "bg-white text-slate-900"
                            : "bg-transparent hover:bg-white/5"
                    }`}
                >
                    Default
                </button>
                <button
                    type="button"
                    onClick={() => setTheme("light")}
                    className={`px-2.5 py-1 ${
                        theme === "light"
                            ? "bg-white text-slate-900"
                            : "bg-transparent hover:bg-white/5"
                    }`}
                >
                    Light
                </button>
            </div>
        </div>
    )
}

