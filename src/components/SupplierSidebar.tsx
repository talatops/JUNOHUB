"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
    LayoutDashboard,
    Package,
    ShoppingCart,
    Users,
    Mail,
    HelpCircle,
} from "lucide-react"
import Image from "next/image"
import { cn } from "@/lib/utils"

const supplierRoutes = [
    {
        label: "Dashboard",
        icon: LayoutDashboard,
        href: "/supplier",
        color: "text-indigo-500",
    },
    {
        label: "Products",
        icon: Package,
        href: "/supplier/products",
        color: "text-emerald-500",
    },
    {
        label: "Orders",
        icon: ShoppingCart,
        href: "/supplier/orders",
        color: "text-blue-500",
    },
    {
        label: "Vendors",
        icon: Users,
        href: "/supplier/vendors",
        color: "text-purple-500",
    },
    {
        label: "JUNO CHAT",
        icon: Mail,
        href: "/supplier/chat",
        color: "text-pink-500",
    },
]

interface SupplierSidebarProps {
    showLogo?: boolean
}

export function SupplierSidebar({ showLogo = true }: SupplierSidebarProps) {
    const pathname = usePathname()
    const isRouteActive = (href: string) => {
        if (href === "/supplier") return pathname === "/supplier"
        return pathname === href || pathname.startsWith(`${href}/`)
    }

    return (
        <div className="space-y-4 py-4 flex flex-col h-full text-white">
            {showLogo && (
                <div className="px-6 py-2 flex items-center mb-6">
                    <div className="w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center mr-3 shadow-md border border-white/10">
                        <Image
                            src="/logo.png"
                            alt="JUNO Logo"
                            width={36}
                            height={36}
                            className="object-cover"
                        />
                    </div>
                    <h1 className="text-xl font-bold tracking-tight">JUNO</h1>
                </div>
            )}
            <div className="flex-1 px-3 space-y-1 overflow-y-auto">
                {supplierRoutes.map((route) => (
                    <Link
                        key={route.href}
                        href={route.href}
                        className={cn(
                            "text-sm group flex p-3 w-full justify-start font-medium cursor-pointer hover:text-white hover:bg-white/10 rounded-xl transition-all duration-200 ease-out border border-transparent",
                            isRouteActive(route.href) ? "text-white bg-white/10 border-white/10" : "text-slate-400"
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
                <Link
                    href="/supplier/help-support"
                    className={cn(
                        "text-sm group flex p-3 w-full justify-start font-medium cursor-pointer rounded-xl transition-all duration-200 ease-out border border-transparent",
                        pathname === "/supplier/help-support"
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
