"use client"

import { useRouter, usePathname } from "next/navigation"
import {
    Ticket,
    Flag,
    Mail,
    Layers,
    HelpCircle,
    MessageCircle,
} from "lucide-react"

export default function JunoEngineLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const router = useRouter()
    const pathname = usePathname()

    const tabs = [
        {
            label: "Knowledge Base",
            href: "/dashboard/juno-engine/knowledge-base",
            icon: HelpCircle
        },
        {
            label: "Modules",
            href: "/dashboard/juno-engine/modules",
            icon: Layers
        },
        {
            label: "Storefront Chat",
            href: "/dashboard/juno-engine/storefront-chat",
            icon: MessageCircle
        },
        {
            label: "Tickets",
            href: "/dashboard/juno-engine/tickets",
            icon: Ticket
        },
        {
            label: "Flagged Emails",
            href: "/dashboard/juno-engine/flagged-email",
            icon: Flag
        },
        {
            label: "Gmail",
            href: "/dashboard/juno-engine/gmail-connect",
            icon: Mail
        },
    ]

    return (
        <div className="flex w-full flex-col gap-4 md:gap-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
                <div>
                    <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">JUNO Engine</h1>
                    <p className="text-sm md:text-base text-slate-400 mt-1">Manage your communication and support infrastructure.</p>
                </div>
            </div>

            <div className="flex gap-2 md:gap-3 border-b border-white/10 overflow-x-auto shrink-0">
                {tabs.map((tab) => {
                    const isActive = pathname === tab.href
                    const Icon = tab.icon
                    return (
                        <button
                            key={tab.href}
                            onClick={() => router.push(tab.href)}
                            className={`pb-3 md:pb-4 px-3 md:px-4 font-bold transition-all duration-200 ease-out whitespace-nowrap text-sm md:text-base flex items-center gap-2 relative ${isActive
                                    ? "text-indigo-400 border-b-2 border-indigo-500"
                                    : "text-slate-400 hover:text-white"
                                }`}
                        >
                            <Icon className="w-4 h-5 md:w-5 md:h-5 transition-transform duration-200" />
                            <span className="hidden sm:inline">{tab.label}</span>
                        </button>
                    )
                })}
            </div>

            <div className="min-h-0 w-full flex-1">{children}</div>
        </div>
    )
}
