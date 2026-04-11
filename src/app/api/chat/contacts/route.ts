import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

/** One sidebar row per Connection (per vendor store ↔ supplier). */
export type ChatContactRow = {
    id: string
    connectionId: string
    storeId: string
    storeName: string | null
    name: string | null
    email: string | null
    image: string | null
    role: "VENDOR" | "SUPPLIER"
}

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
            },
        })

        if (!user) {
            return new NextResponse("User not found", { status: 404 })
        }

        let contacts: ChatContactRow[] = []

        if (user.role === "VENDOR") {
            // Only show chats for the globally selected store (matches dashboard store switcher).
            let scopedStoreId = user.activeStoreId
            if (!scopedStoreId) {
                const active = await prisma.store.findFirst({
                    where: { userId: user.id, isActive: true },
                    select: { id: true },
                })
                scopedStoreId = active?.id ?? null
            }

            const connections = await prisma.connection.findMany({
                where: {
                    store: {
                        userId: user.id,
                        ...(scopedStoreId ? { id: scopedStoreId } : {}),
                    },
                    status: "CONNECTED",
                },
                include: {
                    store: {
                        select: {
                            id: true,
                            businessName: true,
                        },
                    },
                    supplier: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    name: true,
                                    email: true,
                                    image: true,
                                },
                            },
                        },
                    },
                },
            })
            type C = (typeof connections)[number]
            contacts = connections.map((c: C) => ({
                id: c.supplier.user.id,
                connectionId: c.id,
                storeId: c.store.id,
                storeName: c.store.businessName,
                name: c.supplier.companyName || c.supplier.user.name,
                email: c.supplier.user.email,
                image: c.supplier.user.image,
                role: "SUPPLIER" as const,
            }))
            contacts.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "") || (a.storeName ?? "").localeCompare(b.storeName ?? ""))
        } else if (user.role === "SUPPLIER" && user.supplierProfile) {
            const connections = await prisma.connection.findMany({
                where: {
                    supplierId: user.supplierProfile.id,
                    status: "CONNECTED",
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
                                },
                            },
                        },
                    },
                },
            })
            type C = (typeof connections)[number]
            contacts = connections.map((c: C) => ({
                id: c.store.user.id,
                connectionId: c.id,
                storeId: c.store.id,
                storeName: c.store.businessName,
                name: c.store.user.name || c.store.businessName,
                email: c.store.user.email,
                image: c.store.user.image,
                role: "VENDOR" as const,
            }))
            contacts.sort((a, b) => (a.storeName ?? "").localeCompare(b.storeName ?? "") || (a.name ?? "").localeCompare(b.name ?? ""))
        }

        return NextResponse.json({ contacts })
    } catch (error) {
        console.error("[CHAT_CONTACTS]", error)
        return new NextResponse("Internal Error", { status: 500 })
    }
}
