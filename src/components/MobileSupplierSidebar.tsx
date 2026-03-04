"use client"

import { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import { usePathname } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { X, Menu } from "lucide-react"
import { SupplierSidebar } from "./SupplierSidebar"
import Image from "next/image"

export function MobileSupplierSidebar() {
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
                className="md:hidden p-2 rounded-lg bg-white/10 border border-white/10 text-white hover:bg-white/15 transition-all"
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
                                key="supplier-sidebar-backdrop"
                                transition={{ duration: 0.2 }}
                                onClick={() => setIsOpen(false)}
                                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99999] md:hidden"
                            />
                            <motion.div
                                initial={{ x: -288 }}
                                animate={{ x: 0 }}
                                exit={{ x: -288 }}
                                key="supplier-sidebar-content"
                                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                                className="fixed left-0 top-0 bottom-0 w-72 bg-slate-900/95 backdrop-blur-xl border-r border-white/10 z-[100000] md:hidden overflow-y-auto"
                            >
                                <div className="p-4 flex items-center justify-between border-b border-white/10">
                                    <div className="flex items-center gap-2">
                                        <div className="w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center shadow-md border border-white/10">
                                            <Image
                                                src="/logo.png"
                                                alt="JUNO Logo"
                                                width={36}
                                                height={36}
                                                className="object-cover"
                                            />
                                        </div>
                                        <h1 className="text-xl font-bold tracking-tight text-white">JUNO</h1>
                                    </div>
                                    <button
                                        onClick={() => setIsOpen(false)}
                                        className="p-2 rounded-lg hover:bg-white/10 text-white transition-colors"
                                        aria-label="Close menu"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                                <SupplierSidebar showLogo={false} />
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </>
    )
}
