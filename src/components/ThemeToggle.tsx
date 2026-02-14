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
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${isLight
                    ? "border-slate-300 bg-white/80 text-slate-700 hover:bg-slate-100"
                    : "border-white/15 bg-slate-900/40 text-slate-200 hover:bg-white/10"
                    }`}
                aria-label="Toggle theme"
            >
                {isLight ? (
                    <Sun className="h-3.5 w-3.5 text-amber-500" />
                ) : (
                    <Moon className="h-3.5 w-3.5 text-sky-300" />
                )}
                <span className="hidden xs:inline">{isLight ? "Light" : "Default"}</span>
            </button>

            <div className={`hidden md:flex rounded-full border text-[11px] font-semibold overflow-hidden ${isLight
                ? "border-slate-300 bg-slate-100 text-slate-600"
                : "border-white/10 bg-slate-900/50 text-slate-300"
                }`}>
                <button
                    type="button"
                    onClick={() => setTheme("default")}
                    className={`px-2.5 py-1 ${theme === "default"
                        ? isLight
                            ? "bg-slate-700 text-white"
                            : "bg-white text-slate-900"
                        : isLight
                            ? "bg-transparent hover:bg-slate-200"
                            : "bg-transparent hover:bg-white/5"
                        }`}
                >
                    Default
                </button>
                <button
                    type="button"
                    onClick={() => setTheme("light")}
                    className={`px-2.5 py-1 ${theme === "light"
                        ? isLight
                            ? "bg-slate-700 text-white"
                            : "bg-white text-slate-900"
                        : isLight
                            ? "bg-transparent hover:bg-slate-200"
                            : "bg-transparent hover:bg-white/5"
                        }`}
                >
                    Light
                </button>
            </div>
        </div>
    )
}

