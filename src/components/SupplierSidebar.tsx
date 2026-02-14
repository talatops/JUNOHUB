"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
    LayoutDashboard,
    Package,
    ShoppingCart,
    Users,
    Mail,
    Zap,
} from "lucide-react"
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

export function SupplierSidebar() {
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
                {supplierRoutes.map((route) => (
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
        </div>
    )
}
