"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import {
    LayoutDashboard,
    Package,
    ShoppingCart,
    PlusSquare,
    Users,
    Settings,
    LogOut,
    Bell,
    Search,
    ChevronRight,
    Layout
} from "lucide-react"

const menuItems = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
    { icon: Package, label: "Inventory", href: "/dashboard/inventory" },
    { icon: ShoppingCart, label: "Orders", href: "/dashboard/orders" },
    { icon: PlusSquare, label: "New Products", href: "/dashboard/products/new" },
    { icon: Users, label: "Suppliers", href: "/dashboard/suppliers" },
]

export default function DashboardSidebar({
    children,
}: {
    children: React.ReactNode
}) {
    const pathname = usePathname()

    const handleSignOut = async () => {
        const callbackUrl = "/login?role=VENDOR&loggedOut=1"
        const basePath = "/api/auth/vendor"

        try {
            const csrfRes = await fetch(`${basePath}/csrf`, { method: "GET" })
            const csrfData = await csrfRes.json().catch(() => ({}))
            const csrfToken = csrfData?.csrfToken ?? ""

            const signoutRes = await fetch(`${basePath}/signout`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "X-Auth-Return-Redirect": "1",
                },
                body: new URLSearchParams({ csrfToken, callbackUrl }),
            })

            const data = await signoutRes.json().catch(() => ({}))
            window.location.href = data?.url ?? callbackUrl
        } catch {
            // Fallback: best-effort local cookie clear (role-scoped cookie names)
            const cookieNames = ["authjs.session-token-vendor", "__Secure-authjs.session-token-vendor"]
            for (const cookieName of cookieNames) {
                try {
                    document.cookie = `${cookieName}=; path=/; max-age=0; samesite=lax`
                } catch {
                    // ignore
                }
            }
            window.location.href = callbackUrl
        }
    }

    return (
        <div className="flex h-screen bg-slate-50 font-sans text-slate-900">
            {/* Sidebar */}
            <aside className="w-72 bg-white border-r border-slate-200 flex flex-col shrink-0 overflow-hidden">
                <div className="h-20 flex items-center px-8 border-b border-slate-50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-100">
                            <Layout className="w-6 h-6 text-white" />
                        </div>
                        <span className="font-extrabold text-2xl tracking-tighter text-slate-900">JUNO</span>
                    </div>
                </div>

                <div className="flex-1 py-8 px-4 space-y-2 overflow-y-auto">
                    <p className="px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Main Menu</p>
                    {menuItems.map((item) => {
                        const isActive = pathname === item.href
                        return (
                            <Link
                                key={item.label}
                                href={item.href}
                                className={`flex items-center gap-4 px-4 h-12 rounded-xl font-bold transition-all group ${isActive
                                        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100"
                                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                                    }`}
                            >
                                <item.icon className={`w-5 h-5 ${isActive ? "text-white" : "text-slate-400 group-hover:text-indigo-600"}`} />
                                <span className="flex-1">{item.label}</span>
                                {isActive && <ChevronRight className="w-4 h-4 text-indigo-200" />}
                            </Link>
                        )
                    })}
                </div>

                <div className="p-4 border-t border-slate-50 space-y-2">
                    <Link
                        href="/dashboard/settings"
                        className="flex items-center gap-4 px-4 h-12 rounded-xl font-bold text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-all"
                    >
                        <Settings className="w-5 h-5 text-slate-400" />
                        <span>Settings</span>
                    </Link>
                    <button
                        onClick={() => void handleSignOut()}
                        className="w-full flex items-center gap-4 px-4 h-12 rounded-xl font-bold text-red-500 hover:bg-red-50 transition-all cursor-pointer"
                    >
                        <LogOut className="w-5 h-5" />
                        <span>Sign Out</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-10 shrink-0 z-20">
                    <div className="flex items-center bg-slate-100 px-4 h-11 rounded-xl border border-slate-200 w-96 group focus-within:ring-2 focus-within:ring-indigo-600/10 focus-within:border-indigo-600 transition-all">
                        <Search className="w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search anything..."
                            className="bg-transparent border-none outline-none px-3 text-sm font-medium w-full placeholder:text-slate-400"
                        />
                    </div>

                    <div className="flex items-center gap-6">
                        <button className="relative w-11 h-11 flex items-center justify-center bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all shadow-sm">
                            <Bell className="w-5 h-5 text-slate-500" />
                            <span className="absolute top-3 right-3 w-2 h-2 bg-indigo-600 rounded-full border-2 border-white"></span>
                        </button>
                        <div className="h-10 w-[1px] bg-slate-200"></div>
                        <div className="flex items-center gap-3 pl-2">
                            <div className="text-right">
                                <p className="text-sm font-extrabold text-slate-900">Vendor Portal</p>
                                <p className="text-xs text-slate-500 font-medium">Verified Account</p>
                            </div>
                            <div className="w-11 h-11 rounded-xl bg-indigo-100 flex items-center justify-center border border-indigo-200 shadow-sm overflow-hidden">
                                <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center">
                                    <span className="text-white font-bold text-sm">VP</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 overflow-y-auto p-10 bg-slate-50/50">
                    {children}
                </main>
            </div>
        </div>
    )
}
