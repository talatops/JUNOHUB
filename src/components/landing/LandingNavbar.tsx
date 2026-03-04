"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { Menu, X, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"
import Image from "next/image"

interface LandingNavbarProps {
    isLoggedIn: boolean
}

export function LandingNavbar({ isLoggedIn }: LandingNavbarProps) {
    const [isScrolled, setIsScrolled] = useState(false)
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 20)
        }
        window.addEventListener("scroll", handleScroll)
        return () => window.removeEventListener("scroll", handleScroll)
    }, [])

    const navLinks = [
        { name: "Features", href: "#features" },
        { name: "Solutions", href: "#solutions" },
        { name: "Support", href: "#support" },
    ]

    return (
        <header
            className={cn(
                "fixed top-0 left-0 right-0 z-[100] transition-all duration-500 px-6 py-4",
                isScrolled ? "py-3" : "py-6"
            )}
        >
            <nav
                className={cn(
                    "max-w-7xl mx-auto rounded-full transition-all duration-500 px-6 py-2 flex items-center justify-between",
                    isScrolled
                        ? "bg-slate-900/80 backdrop-blur-xl border border-white/10 shadow-2xl shadow-indigo-500/10"
                        : "bg-transparent border border-transparent"
                )}
            >
                {/* Logo */}
                <Link href="/" className="flex items-center gap-3 group">
                    <div className="w-10 h-10 rounded-xl bg-indigo-600/10 border border-white/10 flex items-center justify-center backdrop-blur-sm overflow-hidden shadow-lg shadow-indigo-500/20 group-hover:scale-110 transition-transform">
                        <Image
                            src="/logo.png"
                            alt="JUNO Logo"
                            width={40}
                            height={40}
                            className="object-cover"
                        />
                    </div>
                    <span className="text-xl font-black tracking-tighter text-white">JUNO</span>
                </Link>

                {/* Desktop Nav */}
                <div className="hidden md:flex items-center gap-8">
                    {navLinks.map((link) => (
                        <Link
                            key={link.name}
                            href={link.href}
                            className="text-sm font-bold text-slate-300 hover:text-indigo-400 transition-colors"
                        >
                            {link.name}
                        </Link>
                    ))}
                </div>

                {/* Actions */}
                <div className="hidden md:flex items-center gap-4">
                    <Link
                        href="/login"
                        className="text-sm font-bold text-white hover:text-indigo-400 transition-colors"
                    >
                        Sign In
                    </Link>
                    <Link
                        href="/signup"
                        className="px-6 py-2.5 bg-white text-slate-900 hover:bg-slate-100 rounded-full text-sm font-black transition-all shadow-xl active:scale-95"
                    >
                        Get Started
                    </Link>
                </div>

                {/* Mobile Menu Toggle */}
                <button
                    className="md:hidden text-white p-1"
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
                    aria-expanded={mobileMenuOpen}
                >
                    {mobileMenuOpen ? <X /> : <Menu />}
                </button>
            </nav>

            {/* Mobile Menu */}
            <AnimatePresence>
                {mobileMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="md:hidden absolute top-full left-6 right-6 mt-2 bg-slate-900/95 backdrop-blur-2xl rounded-3xl border border-white/10 overflow-hidden shadow-2xl"
                    >
                        <div className="p-6 flex flex-col gap-6">
                            {navLinks.map((link) => (
                                <Link
                                    key={link.name}
                                    href={link.href}
                                    className="text-lg font-bold text-slate-300"
                                    onClick={() => setMobileMenuOpen(false)}
                                >
                                    {link.name}
                                </Link>
                            ))}
                            <hr className="border-white/5" />
                            <div className="flex flex-col gap-4">
                                <Link
                                    href="/login"
                                    className="w-full py-4 bg-white/5 text-white rounded-2xl text-center font-black border border-white/10"
                                    onClick={() => setMobileMenuOpen(false)}
                                >
                                    Sign In
                                </Link>
                                <Link
                                    href="/signup"
                                    className="w-full py-4 bg-white text-slate-900 rounded-2xl text-center font-black shadow-lg"
                                    onClick={() => setMobileMenuOpen(false)}
                                >
                                    Get Started
                                </Link>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </header>
    )
}
