import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return new NextResponse("Unauthorized", { status: 401 })
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            include: {
                supplierProfile: true,
            }
        })

        if (!user) {
            return new NextResponse("User not found", { status: 404 })
        }

        interface Contact {
            id: string
            name: string | null
            email: string | null
            image: string | null
            role: string
        }
        let contacts: Contact[] = []

        if (user.role === "VENDOR") {
            // Fetch connected suppliers
            const connections = await prisma.connection.findMany({
                where: {
                    store: { userId: user.id },
                    status: "CONNECTED"
                },
                include: {
                    supplier: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    name: true,
                                    email: true,
                                    image: true,
                                }
                            }
                        }
                    }
                }
            })
            type VendorSideConnection = (typeof connections)[number]
            contacts = connections.map((c: VendorSideConnection) => ({
                id: c.supplier.user.id,
                name: c.supplier.companyName || c.supplier.user.name,
                email: c.supplier.user.email,
                image: c.supplier.user.image,
                role: "SUPPLIER"
            }))
        } else if (user.role === "SUPPLIER" && user.supplierProfile) {
            // Fetch connected vendors
            const connections = await prisma.connection.findMany({
                where: {
                    supplierId: user.supplierProfile.id,
                    status: "CONNECTED"
                },
                include: {
                    store: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    name: true,
                                    email: true,
                                    image: true,
                                }
                            }
                        }
                    }
                }
            })
            type SupplierSideConnection = (typeof connections)[number]
            contacts = connections.map((c: SupplierSideConnection) => ({
                id: c.store.user.id,
                name: c.store.businessName || c.store.user.name,
                email: c.store.user.email,
                image: c.store.user.image,
                role: "VENDOR"
            }))
        }

        return NextResponse.json({ contacts })
    } catch (error) {
        console.error("[CHAT_CONTACTS]", error)
        return new NextResponse("Internal Error", { status: 500 })
    }
}
