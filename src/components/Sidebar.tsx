"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
    LayoutDashboard,
    Package,
    ShoppingCart,
    Zap,
    Users,
    Globe,
    UserCheck,
    Settings,
    Ticket,
    Flag,
    Mail,
    FileText,
    HelpCircle
} from "lucide-react"
import { cn } from "@/lib/utils"

const routes = [
    {
        label: "Dashboard",
        icon: LayoutDashboard,
        href: "/dashboard",
        color: "text-indigo-500",
    },
    {
        label: "Inventory",
        icon: Package,
        href: "/dashboard/inventory",
        color: "text-emerald-500",
    },
    {
        label: "Orders",
        icon: ShoppingCart,
        href: "/dashboard/orders",
        color: "text-blue-500",
    },
    {
        label: "Customers",
        icon: Users,
        href: "/dashboard/customers",
        color: "text-orange-500",
    },
    {
        label: "New Products",
        icon: Zap,
        href: "/dashboard/new-products",
        color: "text-yellow-500",
    },
    {
        label: "Suppliers",
        icon: Users,
        href: "/dashboard/suppliers",
        color: "text-purple-500",
        subRoutes: [
            { label: "Global Suppliers", href: "/dashboard/suppliers/global", icon: Globe },
            { label: "My Suppliers", href: "/dashboard/suppliers/my", icon: UserCheck },
        ]
    },
    {
        label: "JUNO Engine",
        icon: Settings,
        href: "/dashboard/juno-engine",
        color: "text-cyan-500",
        subRoutes: [
            { label: "Knowledge Base", href: "/dashboard/juno-engine/knowledge-base", icon: HelpCircle },
            { label: "Templates", href: "/dashboard/juno-engine/email-templates", icon: FileText },
            { label: "Tickets", href: "/dashboard/juno-engine/tickets", icon: Ticket },
            { label: "Flagged Emails", href: "/dashboard/juno-engine/flagged-email", icon: Flag },
            { label: "Gmail", href: "/dashboard/juno-engine/gmail-connect", icon: Mail },
        ]
    }
]

export function Sidebar() {
    const pathname = usePathname()

    return (
        <div className="space-y-4 py-4 flex flex-col h-full text-white">
            <div className="px-6 py-2 flex items-center mb-6">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/40 border border-white/20 flex items-center justify-center mr-3 backdrop-blur-sm">
                    <Zap className="w-5 h-5 text-white fill-white" />
                </div>
                <h1 className="text-xl font-bold tracking-tight">JUNOHUB</h1>
            </div>
            <div className="flex-1 px-3 space-y-1 overflow-y-auto">
                {routes.map((route) => (
                    <div key={route.href}>
                        <Link
                            href={route.href}
                            className={cn(
                                "text-sm group flex p-3 w-full justify-start font-medium cursor-pointer hover:text-white hover:bg-white/10 rounded-xl transition-all duration-200 ease-out border border-transparent",
                                pathname.startsWith(route.href) ? "text-white bg-white/10 border-white/10" : "text-slate-400"
                            )}
                        >
                            <div className="flex items-center flex-1">
                                <route.icon className={cn("h-5 w-5 mr-3", route.color)} />
                                {route.label}
                            </div>
                        </Link>
                        {route.subRoutes && pathname.startsWith(route.href) && (
                            <div className="ml-8 mt-1 space-y-1">
                                {route.subRoutes.map((sub) => (
                                    <Link
                                        key={sub.href}
                                        href={sub.href}
                                        className={cn(
                                            "text-xs group flex p-2 w-full justify-start font-medium cursor-pointer hover:text-white hover:bg-white/5 rounded-lg transition-all duration-200 ease-out",
                                            pathname === sub.href ? "text-white bg-white/5" : "text-slate-500"
                                        )}
                                    >
                                        <div className="flex items-center flex-1">
                                            <sub.icon className="h-4 w-4 mr-2 opacity-70" />
                                            {sub.label}
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
            <div className="px-3 pt-4 border-t border-white/10">
                <Link
                    href="/dashboard/help-support"
                    className={cn(
                        "text-sm group flex p-3 w-full justify-start font-medium cursor-pointer hover:text-white hover:bg-white/10 rounded-xl transition-all duration-200 ease-out border border-transparent",
                        pathname === "/dashboard/help-support" ? "text-white bg-white/10 border-white/10" : "text-slate-400"
                    )}
                >
                    <div className="flex items-center flex-1">
                        <HelpCircle className="h-5 w-5 mr-3 text-blue-500" />
                        Help & Support
                    </div>
                </Link>
            </div>
        </div>
    )
}
