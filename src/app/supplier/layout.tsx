import { SupplierSidebar } from "@/components/SupplierSidebar"
import { MobileSupplierSidebar } from "@/components/MobileSupplierSidebar"
import UserAccountMenu from "@/components/UserAccountMenu"
import NotificationBell from "@/components/NotificationBell"
import PageTransition from "@/components/PageTransition"
import ThemeToggle from "@/components/ThemeToggle"
import { auth } from "@/auth.supplier"
import { redirect } from "next/navigation"

export default async function SupplierLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const session = await auth()

    if (!session?.user) {
        redirect("/login")
    }

    // Only allow SUPPLIER role to access supplier dashboard
    const role = session.user.role
    if (!role) {
        redirect("/login")
    }

    if (role !== "SUPPLIER") {
        if (role === "VENDOR") {
            redirect("/dashboard")
        }
        redirect("/login?error=WrongRole")
    }

    // Ensure supplier profile exists, create if not
    const { prisma } = await import("@/lib/prisma")

    // Safety guard: make sure the corresponding User row exists in our application database.
    // This can be missing after a database reset or if auth is backed by a different store.
    const existingUser = await prisma.user.findUnique({
        where: { id: session.user.id }
    })

    if (!existingUser) {
        await prisma.user.create({
            data: {
                id: session.user.id,
                name: session.user.name,
                email: session.user.email,
                image: (session.user as { image?: string | null })?.image ?? null,
                role: session.user.role,
            }
        })
    }

    let supplierProfile = await prisma.supplierProfile.findUnique({
        where: { userId: session.user.id }
    })

    if (!supplierProfile) {
        // Create default supplier profile, but guard against inconsistent data
        try {
            supplierProfile = await prisma.supplierProfile.create({
                data: {
                    userId: session.user.id,
                    companyName: session.user.name || "My Company",
                    description: null
                }
            })
        } catch (error) {
            if (error && typeof error === "object" && (error as { code?: string }).code === "P2003") {
                console.error(
                    "[SUPPLIER_LAYOUT] Failed to create supplier profile due to missing user row",
                    { userId: session.user.id, error }
                )
                // Session says user exists but DB row is missing; surface a clear error instead of looping redirects.
                throw new Error(
                    "Your supplier account is missing required data in the database. Please try logging out and back in, or contact support."
                )
            }
            throw error
        }
    }

    return (
        <div className="flex h-screen w-full relative font-sans dashboard-glass-dark overflow-hidden">
            {/* Desktop Sidebar */}
            <div className="hidden h-full md:flex md:w-72 md:flex-col md:fixed md:inset-y-0 z-[80] bg-slate-900/70 border-r border-white/10 backdrop-blur-xl">
                <SupplierSidebar />
            </div>

            <main className="md:pl-72 flex flex-col flex-1 h-full min-w-0">
                <header className="h-16 px-4 md:px-8 border-b border-white/10 bg-slate-900/50 backdrop-blur-xl flex items-center justify-between flex-shrink-0 z-[100]">
                    <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
                        <MobileSupplierSidebar />
                        <h2 className="hidden sm:block text-xs md:text-sm font-semibold text-slate-400 uppercase tracking-wider">Supplier Portal</h2>
                    </div>
                    <div className="flex items-center gap-2 md:gap-4 shrink-0">
                        <ThemeToggle />
                        <NotificationBell />
                        <div className="hidden sm:flex flex-col text-right">
                            <span className="text-xs font-bold text-white truncate max-w-[120px]">{session.user?.name || "Supplier User"}</span>
                            <span className="text-[10px] text-slate-400 truncate max-w-[120px]">{session.user?.email}</span>
                        </div>
                        <UserAccountMenu />
                    </div>
                </header>
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                    <PageTransition className="p-4 md:p-8 overflow-y-auto custom-scrollbar flex-1 flex flex-col min-h-0" data-lenis-prevent>
                        {children}
                    </PageTransition>
                </div>
            </main>
        </div>
    )
}
