"use client"

import { User, Shield, BellRing, MessageCircle } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const settingsTabs = [
    {
        id: "account",
        label: "Account",
        icon: User,
        href: "/dashboard/settings/account"
    },
    {
        id: "security",
        label: "Security",
        icon: Shield,
        href: "/dashboard/settings/security"
    },
    {
        id: "low-stock",
        label: "Low stock",
        icon: BellRing,
        href: "/dashboard/settings/low-stock"
    },
    {
        id: "storefront",
        label: "Storefront",
        icon: MessageCircle,
        href: "/dashboard/settings/storefront"
    },
]

export default function SettingsLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const pathname = usePathname()

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">Settings</h1>
                <p className="text-sm md:text-base text-slate-400 mt-1">
                    Manage your account, security, low-stock alerts, and storefront chat session settings.
                </p>
            </div>

            <div className="bg-white/5 backdrop-blur-xl rounded-xl md:rounded-2xl border border-white/10 overflow-hidden">
                {/* Tabs */}
                <div className="border-b border-white/10 bg-white/5 p-4">
                    <div className="flex gap-2">
                        {settingsTabs.map((tab) => {
                            const Icon = tab.icon
                            const isActive = pathname === tab.href
                            return (
                                <Link
                                    key={tab.id}
                                    href={tab.href}
                                    className={cn(
                                        "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                                        isActive
                                            ? "bg-indigo-500 text-white"
                                            : "text-slate-400 hover:text-white hover:bg-white/10"
                                    )}
                                >
                                    <Icon className="w-4 h-4" />
                                    {tab.label}
                                </Link>
                            )
                        })}
                    </div>
                </div>

                {/* Content */}
                <div className="p-6">
                    {children}
                </div>
            </div>
        </div>
    )
}
