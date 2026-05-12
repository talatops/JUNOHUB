import { Sidebar } from "@/components/Sidebar"
import { MobileSidebar } from "@/components/MobileSidebar"
import StoreSwitcher from "@/components/StoreSwitcher"
import UserAccountMenu from "@/components/UserAccountMenu"
import NotificationBell from "@/components/NotificationBell"
import PageTransition from "@/components/PageTransition"
import ThemeToggle from "@/components/ThemeToggle"
import { auth } from "@/auth.vendor"
import { redirect } from "next/navigation"

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const session = await auth()

    if (!session?.user) {
        redirect("/login")
    }

    const role = session.user.role
    if (!role) {
        redirect("/login")
    }

    if (role !== "VENDOR") {
        if (role === "SUPPLIER") {
            redirect("/supplier")
        }
        redirect("/login?error=WrongRole")
    }

    const { prisma } = await import("@/lib/prisma")
    const storeWithOnboarding = await prisma.store.findFirst({
        where: { userId: session.user.id, onboardingComplete: true }
    })

    if (!storeWithOnboarding) {
        redirect("/onboarding")
    }

    return (
        <div className="flex h-screen w-full relative font-sans dashboard-glass-dark overflow-hidden">
            {/* Desktop Sidebar */}
            <div className="hidden h-full md:flex md:w-72 md:flex-col md:fixed md:inset-y-0 z-[80] bg-slate-900/70 border-r border-white/10 backdrop-blur-xl">
                <Sidebar />
            </div>

            {/* Main Content Area */}
            <main className="md:pl-72 flex flex-col flex-1 h-full min-w-0">
                {/* Fixed Header */}
                <header className="h-16 px-4 md:px-8 border-b border-white/10 bg-slate-900/50 backdrop-blur-xl flex items-center justify-between flex-shrink-0 z-50">
                    <div className="flex items-center gap-1.5 md:gap-4 flex-1 min-w-0">
                        <MobileSidebar />
                        <h2 className="hidden lg:block text-xs md:text-sm font-semibold text-slate-400 uppercase tracking-wider shrink-0">Vendor Portal</h2>
                        <div className="flex-1 min-w-0 max-w-[200px] md:max-w-none">
                            <StoreSwitcher />
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5 md:gap-4 shrink-0">
                        <ThemeToggle />
                        <NotificationBell />
                        <div className="hidden sm:flex flex-col text-right">
                            <span className="text-xs font-bold text-white truncate max-w-[120px]">
                                {session.user?.name || "Vendor User"}
                            </span>
                            <span className="text-[10px] text-slate-400 truncate max-w-[120px]">
                                {session.user?.email}
                            </span>
                        </div>
                        <UserAccountMenu />
                    </div>
                </header>

                <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                    <PageTransition className="p-3 sm:p-4 lg:p-6 2xl:p-7 overflow-y-auto custom-scrollbar" data-lenis-prevent>
                        <div className="flex-1 flex flex-col min-h-0">
                            {children}
                        </div>
                    </PageTransition>
                </div>
            </main>
        </div>
    )
}