import { SupplierSidebar } from "@/components/SupplierSidebar"
import { MobileSupplierSidebar } from "@/components/MobileSupplierSidebar"
import UserAccountMenu from "@/components/UserAccountMenu"
import NotificationBell from "@/components/NotificationBell"
import PageTransition from "@/components/PageTransition"
import { auth } from "@/auth"
import { redirect } from "next/navigation"

export default async function SupplierLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const session = await auth()

    if (!session) {
        redirect("/login")
    }

    // Only allow SUPPLIER role to access supplier dashboard
    if (session.user.role !== "SUPPLIER") {
        redirect("/dashboard")
    }

    // Ensure supplier profile exists, create if not
    const { prisma } = await import("@/lib/prisma")
    let supplierProfile = await prisma.supplierProfile.findUnique({
        where: { userId: session.user.id }
    })

    if (!supplierProfile) {
        // Create default supplier profile
        supplierProfile = await prisma.supplierProfile.create({
            data: {
                userId: session.user.id,
                companyName: session.user.name || "My Company",
                description: null
            }
        })
    }

    return (
        <div className="flex h-screen w-full relative font-sans dashboard-glass-dark overflow-hidden">
            {/* Desktop Sidebar */}
            <div className="hidden h-full md:flex md:w-72 md:flex-col md:fixed md:inset-y-0 z-[80] bg-slate-900/70 border-r border-white/10 backdrop-blur-xl">
                <SupplierSidebar />
            </div>

            <main className="md:pl-72 flex flex-col flex-1 h-full min-w-0">
                <header className="h-16 px-4 md:px-8 border-b border-white/10 bg-slate-900/50 backdrop-blur-xl flex items-center justify-between flex-shrink-0 z-50">
                    <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
                        <MobileSupplierSidebar />
                        <h2 className="hidden sm:block text-xs md:text-sm font-semibold text-slate-400 uppercase tracking-wider">Supplier Portal</h2>
                    </div>
                    <div className="flex items-center gap-2 md:gap-4 shrink-0">
                        <NotificationBell />
                        <div className="hidden sm:flex flex-col text-right">
                            <span className="text-xs font-bold text-white truncate max-w-[120px]">{session.user?.name || "Supplier User"}</span>
                            <span className="text-[10px] text-slate-400 truncate max-w-[120px]">{session.user?.email}</span>
                        </div>
                        <UserAccountMenu />
                    </div>
                </header>
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                    <PageTransition className="p-4 md:p-8 overflow-y-auto custom-scrollbar">
                        <div className="flex-1 flex flex-col min-h-0">
                            {children}
                        </div>
                    </PageTransition>
                </div>
            </main>
        </div>
    )
}
