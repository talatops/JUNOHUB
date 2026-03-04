"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
    LayoutDashboard,
    Activity,
    Link2,
    Shuffle,
    ShoppingCart,
    Radar,
    HelpCircle,
    Mail
} from "lucide-react"
import { cn } from "@/lib/utils"

const adminRoutes = [
    {
        label: "Overview",
        icon: LayoutDashboard,
        href: "/admin",
        color: "text-indigo-500",
    },
    {
        label: "Events",
        icon: Activity,
        href: "/admin/events",
        color: "text-emerald-500",
    },
    {
        label: "Connections",
        icon: Link2,
        href: "/admin/connections",
        color: "text-blue-500",
    },
    {
        label: "Product Syncs",
        icon: Shuffle,
        href: "/admin/product-syncs",
        color: "text-purple-500",
    },
    {
        label: "Orders",
        icon: ShoppingCart,
        href: "/admin/orders",
        color: "text-orange-500",
    },
    {
        label: "Sync Health",
        icon: Radar,
        href: "/admin/sync-health",
        color: "text-cyan-500",
    },
    {
        label: "Emails",
        icon: Mail,
        href: "/admin/emails",
        color: "text-pink-500",
    },
]

export function AdminSidebar() {
    const pathname = usePathname()

    return (
        <div className="space-y-4 py-4 flex flex-col h-full text-white">
            <div className="px-6 py-2 flex items-center mb-6">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/40 border border-white/20 flex items-center justify-center mr-3 backdrop-blur-sm">
                    <Radar className="w-5 h-5 text-white" />
                </div>
                <div className="flex flex-col">
                    <h1 className="text-xl font-bold tracking-tight">JUNO</h1>
                    <span className="text-[11px] uppercase tracking-widest text-slate-400 font-semibold">
                        Admin Portal
                    </span>
                </div>
            </div>
            <div className="flex-1 px-3 space-y-1 overflow-y-auto">
                {adminRoutes.map((route) => (
                    <Link
                        key={route.href}
                        href={route.href}
                        className={cn(
                            "text-sm group flex p-3 w-full justify-start font-medium cursor-pointer hover:text-white hover:bg-white/10 rounded-xl transition-all duration-200 ease-out border border-transparent",
                            pathname === route.href ? "text-white bg-white/10 border-white/10" : "text-slate-400"
                        )}
                    >
                        <div className="flex items-center flex-1">
                            <route.icon className={cn("h-5 w-5 mr-3", route.color)} />
                            {route.label}
                        </div>
                    </Link>
                ))}
            </div>
            <div className="px-3 pt-4 border-t border-white/10">
                <div className="text-[11px] text-slate-500 flex items-center gap-2">
                    <HelpCircle className="w-3 h-3" />
                    Observability-only. No write actions.
                </div>
            </div>
        </div>
    )
}

