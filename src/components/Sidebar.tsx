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
    Layers,
    HelpCircle,
    MessageCircle,
    Store,
    BarChart3,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useTheme } from "@/components/ThemeProvider"
import Image from "next/image"

const routes = [
    {
        label: "Dashboard",
        icon: LayoutDashboard,
        href: "/dashboard",
        color: "text-indigo-500",
    },
    {
        label: "AI Analytics",
        icon: BarChart3,
        href: "/dashboard/ai-analytics",
        color: "text-green-500",
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
        label: "Stores",
        icon: Store,
        href: "/dashboard/stores",
        color: "text-teal-500",
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
            { label: "Modules", href: "/dashboard/juno-engine/modules", icon: Layers },
            {
                label: "Storefront Chat",
                href: "/dashboard/juno-engine/storefront-chat",
                icon: MessageCircle,
            },
            { label: "Tickets", href: "/dashboard/juno-engine/tickets", icon: Ticket },
            { label: "Flagged Emails", href: "/dashboard/juno-engine/flagged-email", icon: Flag },
            { label: "Gmail", href: "/dashboard/juno-engine/gmail-connect", icon: Mail },
        ]
    },
    {
        label: "JUNO CHAT",
        icon: Mail,
        href: "/dashboard/chat",
        color: "text-pink-500",
    }
]

interface SidebarProps {
    showLogo?: boolean;
    className?: string;
}

export function Sidebar({ showLogo = true, className }: SidebarProps) {
    const pathname = usePathname()
    const { theme } = useTheme()
    const isLight = theme === "light"
    const isRouteActive = (href: string) => {
        if (href === "/dashboard") return pathname === "/dashboard"
        return pathname === href || pathname.startsWith(`${href}/`)
    }

    return (
        <div className={cn(
            "space-y-4 py-4 flex flex-col h-full transition-colors duration-300",
            isLight ? "bg-white border-r border-slate-100 text-slate-900" : "text-white",
            className
        )}>
            {showLogo && (
                <div className="px-6 py-2 flex items-center mb-6">
                    <div className={cn(
                        "w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center mr-3 shadow-md border",
                        isLight ? "border-slate-200" : "border-white/10"
                    )}>
                        <Image
                            src="/logo.png"
                            alt="JUNO Logo"
                            width={40}
                            height={40}
                            className="object-cover"
                        />
                    </div>
                    <h1 className={cn("text-xl font-bold tracking-tight", isLight ? "text-slate-900" : "text-white")}>JUNO</h1>
                </div>
            )}
            <div className="flex-1 px-3 space-y-1 overflow-y-auto">
                {routes.map((route) => (
                    <div key={route.href}>
                        <Link
                            href={route.href}
                            className={cn(
                                "text-sm group flex p-3 w-full justify-start font-medium cursor-pointer rounded-xl transition-all duration-200 ease-out border border-transparent",
                                isLight
                                    ? isRouteActive(route.href)
                                        ? "text-indigo-600 bg-indigo-50 border-indigo-100"
                                        : "text-slate-600 hover:text-indigo-600 hover:bg-slate-50"
                                    : isRouteActive(route.href)
                                        ? "text-white bg-white/10 border-white/10"
                                        : "text-slate-400 hover:text-white hover:bg-white/10"
                            )}
                        >
                            <div className="flex items-center flex-1">
                                <route.icon className={cn("h-5 w-5 mr-3", route.color)} />
                                {route.label}
                            </div>
                        </Link>
                        {route.subRoutes && isRouteActive(route.href) && (
                            <div className="ml-8 mt-1 space-y-1">
                                {route.subRoutes.map((sub) => (
                                    <Link
                                        key={sub.href}
                                        href={sub.href}
                                        className={cn(
                                            "text-xs group flex p-2 w-full justify-start font-medium cursor-pointer rounded-lg transition-all duration-200 ease-out",
                                            isLight
                                                ? pathname === sub.href
                                                    ? "text-indigo-600 bg-indigo-50/50"
                                                    : "text-slate-500 hover:text-indigo-600 hover:bg-slate-50"
                                                : pathname === sub.href
                                                    ? "text-white bg-white/5"
                                                    : "text-slate-500 hover:text-white hover:bg-white/5"
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
            <div className={cn("px-3 pt-4 border-t", isLight ? "border-slate-100" : "border-white/10")}>
                <Link
                    href="/dashboard/help-support"
                    className={cn(
                        "text-sm group flex p-3 w-full justify-start font-medium cursor-pointer rounded-xl transition-all duration-200 ease-out border border-transparent",
                        isLight
                            ? pathname === "/dashboard/help-support"
                                ? "text-blue-600 bg-blue-50 border-blue-100"
                                : "text-slate-600 hover:text-blue-600 hover:bg-slate-50"
                            : pathname === "/dashboard/help-support"
                                ? "text-white bg-white/10 border-white/10"
                                : "text-slate-400 hover:text-white hover:bg-white/10"
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
