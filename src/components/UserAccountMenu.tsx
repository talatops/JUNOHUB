"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { signOut, useSession } from "next-auth/react"
import { Settings, LogOut, ChevronDown } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useTheme } from "@/components/ThemeProvider"

export default function UserAccountMenu() {
    const { data: session } = useSession()
    const router = useRouter()
    const [isOpen, setIsOpen] = useState(false)
    const menuRef = useRef<HTMLDivElement>(null)
    const { theme } = useTheme()
    const isLight = theme === "light"

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside)
            return () => document.removeEventListener("mousedown", handleClickOutside)
        }
    }, [isOpen])

    const handleSettings = () => {
        setIsOpen(false)
        router.push("/dashboard/settings")
    }

    const handleLogout = async () => {
        setIsOpen(false)
        await signOut({ callbackUrl: "/login" })
    }

    const userInitial = session?.user?.name?.[0] || session?.user?.email?.[0] || "V"

    return (
        <div className="relative" ref={menuRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            >
                <div className="w-8 h-8 rounded-full bg-indigo-500/30 border border-white/20 flex items-center justify-center text-white font-bold text-xs backdrop-blur-sm shrink-0">
                    {userInitial}
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -4 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -4 }}
                        transition={{ duration: 0.15, ease: "easeOut" }}
                        className={`absolute right-0 top-full mt-2 backdrop-blur-xl border rounded-xl shadow-xl overflow-hidden z-50 min-w-[180px] ${isLight
                                ? "bg-white/95 border-slate-200"
                                : "bg-slate-800/95 border-white/10"
                            }`}
                    >
                        <button
                            onClick={handleSettings}
                            className={`w-full px-4 py-2.5 text-left text-sm font-medium transition-colors flex items-center gap-2 ${isLight
                                    ? "text-slate-700 hover:bg-indigo-500 hover:text-white"
                                    : "text-slate-200 hover:bg-indigo-500 hover:text-white"
                                }`}
                        >
                            <Settings className="w-4 h-4" />
                            Settings
                        </button>
                        <div className={`border-t ${isLight ? "border-slate-200" : "border-white/10"}`}></div>
                        <button
                            onClick={handleLogout}
                            className={`w-full px-4 py-2.5 text-left text-sm font-medium transition-colors flex items-center gap-2 ${isLight
                                    ? "text-red-600 hover:bg-red-500 hover:text-white"
                                    : "text-red-400 hover:bg-red-500 hover:text-white"
                                }`}
                        >
                            <LogOut className="w-4 h-4" />
                            Logout
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
