"use client"

import { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import { usePathname } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { X, Menu } from "lucide-react"
import { Sidebar } from "./Sidebar"

import { useTheme } from "./ThemeProvider"
import { cn } from "@/lib/utils"
import Image from "next/image"

export function MobileSidebar() {
    const { theme } = useTheme()
    const isLight = theme === "light"
    const [isOpen, setIsOpen] = useState(false)
    const pathname = usePathname()
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    // Close sidebar when route changes
    useEffect(() => {
        const timer = setTimeout(() => setIsOpen(false), 0)
        return () => clearTimeout(timer)
    }, [pathname])

    // Prevent body scroll when sidebar is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden"
        } else {
            document.body.style.overflow = ""
        }
        return () => {
            document.body.style.overflow = ""
        }
    }, [isOpen])

    return (
        <>
            {/* Hamburger Button */}
            <button
                onClick={() => setIsOpen(true)}
                className={cn(
                    "md:hidden p-2 rounded-lg transition-all border shadow-sm",
                    isLight
                        ? "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                        : "bg-white/10 border-white/10 text-white hover:bg-white/15"
                )}
                aria-label="Open menu"
            >
                <Menu className="w-6 h-6" />
            </button>

            {/* Mobile Sidebar Overlay */}
            {mounted && createPortal(
                <AnimatePresence mode="wait">
                    {isOpen && (
                        <>
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                key="sidebar-backdrop"
                                transition={{ duration: 0.2 }}
                                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99999] md:hidden pointer-events-auto"
                                onClick={() => setIsOpen(false)}
                            />
                            <motion.div
                                initial={{ x: -288 }}
                                animate={{ x: 0 }}
                                exit={{ x: -288 }}
                                key="sidebar-content"
                                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                                className={cn(
                                    "fixed inset-y-0 left-0 w-72 backdrop-blur-xl border-r z-[100000] md:hidden flex flex-col pointer-events-auto",
                                    isLight
                                        ? "bg-white/95 border-slate-200"
                                        : "bg-slate-900/95 border-white/10"
                                )}
                            >
                                {/* Header with close button */}
                                <div className={cn(
                                    "flex items-center justify-between p-4 border-b",
                                    isLight ? "border-slate-100" : "border-white/10"
                                )}>
                                    <div className="flex items-center gap-2">
                                        <div className={cn(
                                            "w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center shadow-md border",
                                            isLight
                                                ? "border-slate-200"
                                                : "border-white/10"
                                        )}>
                                            <Image
                                                src="/logo.png"
                                                alt="JUNO Logo"
                                                width={36}
                                                height={36}
                                                className="object-cover"
                                            />
                                        </div>
                                        <h1 className={cn(
                                            "text-xl font-bold tracking-tight",
                                            isLight ? "text-slate-900" : "text-white"
                                        )}>JUNO</h1>
                                    </div>
                                    <button
                                        onClick={() => setIsOpen(false)}
                                        className={cn(
                                            "p-2 rounded-lg transition-all border shadow-sm",
                                            isLight
                                                ? "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                                                : "bg-white/10 border-white/10 text-white hover:bg-white/15"
                                        )}
                                        aria-label="Close menu"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                                {/* Sidebar Content */}
                                <div className="flex-1 overflow-y-auto">
                                    <Sidebar showLogo={false} className="!bg-transparent !border-none" />
                                </div>
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </>
    )
}
