import { AdminSidebar } from "@/components/AdminSidebar"
import { MobileAdminSidebar } from "@/components/MobileAdminSidebar"
import UserAccountMenu from "@/components/UserAccountMenu"
import NotificationBell from "@/components/NotificationBell"
import PageTransition from "@/components/PageTransition"
import { auth } from "@/auth"
import { redirect } from "next/navigation"

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const session = await auth()

    if (!session) {
        redirect("/login")
    }

    if (session.user.role !== "ADMIN") {
        // Redirect vendors and suppliers back to their respective dashboards
        if (session.user.role === "VENDOR") {
            redirect("/dashboard")
        }
        if (session.user.role === "SUPPLIER") {
            redirect("/supplier")
        }
        redirect("/login")
    }

    return (
        <div className="flex h-screen w-full relative font-sans dashboard-glass-dark overflow-x-hidden">
            {/* Desktop Sidebar */}
            <div className="hidden h-full md:flex md:w-72 md:flex-col md:fixed md:inset-y-0 z-[80] bg-slate-900/70 border-r border-white/10 backdrop-blur-xl">
                <AdminSidebar />
            </div>

            {/* Main Content Area */}
            <main className="md:pl-72 flex flex-col flex-1 h-full min-w-0">
                {/* Fixed Header */}
                <header className="h-16 px-4 md:px-8 border-b border-white/10 bg-slate-900/50 backdrop-blur-xl flex items-center justify-between flex-shrink-0 z-50">
                    <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
                        {/* Reuse vendor mobile sidebar trigger for consistency */}
                        <MobileAdminSidebar />
                        <div className="flex flex-col">
                            <h2 className="text-xs md:text-sm font-semibold text-slate-300 uppercase tracking-wider">
                                Admin Portal
                            </h2>
                            <span className="text-[10px] text-slate-500 hidden sm:block">
                                Read-only observability for Shopify, vendors & suppliers
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 md:gap-4 shrink-0">
                        <NotificationBell />
                        <div className="hidden sm:flex flex-col text-right">
                            <span className="text-xs font-bold text-white truncate max-w-[140px]">{session.user?.name || "Admin User"}</span>
                            <span className="text-[10px] text-slate-400 truncate max-w-[160px]">{session.user?.email}</span>
                        </div>
                        <UserAccountMenu />
                    </div>
                </header>

                {/* Content */}
                <div className="flex-1 flex flex-col min-h-0 overflow-x-hidden p-4 md:p-8">
                    <PageTransition>
                        <div className="flex-1 flex flex-col min-h-0">
                            {children}
                        </div>
                    </PageTransition>
                </div>
            </main>
        </div>
    )
}

