"use client"

import { useState, useEffect } from "react"
import { Menu, X } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { AdminSidebar } from "@/components/AdminSidebar"

export function MobileAdminSidebar() {
    const [isOpen, setIsOpen] = useState(false)

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
            <button
                onClick={() => setIsOpen(true)}
                className="md:hidden p-2 hover:bg-white/10 rounded-lg transition-colors"
                aria-label="Open admin menu"
            >
                <Menu className="w-5 h-5 text-white" />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[90] md:hidden"
                            onClick={() => setIsOpen(false)}
                        />

                        {/* Sidebar Panel */}
                        <motion.div
                            initial={{ x: -288 }}
                            animate={{ x: 0 }}
                            exit={{ x: -288 }}
                            transition={{ type: "spring", damping: 25, stiffness: 300 }}
                            className="fixed inset-y-0 left-0 w-72 bg-slate-900/95 backdrop-blur-xl border-r border-white/10 z-[100] md:hidden flex flex-col"
                        >
                            <div className="flex items-center justify-between p-4 border-b border-white/10">
                                <span className="text-sm font-bold text-white tracking-wide">Admin Panel</span>
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                                    aria-label="Close admin menu"
                                >
                                    <X className="w-4 h-4 text-slate-400" />
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto">
                                <AdminSidebar />
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    )
}
