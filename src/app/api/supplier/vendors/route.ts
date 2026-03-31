import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

/**
 * GET /api/supplier/vendors
 * List all vendor connections for the authenticated supplier
 */
export async function GET() {
    try {
        const session = await auth()

        if (!session?.user?.id || session.user.role !== "SUPPLIER") {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        // Get supplier profile
        const supplierProfile = await prisma.supplierProfile.findUnique({
            where: { userId: session.user.id }
        })

        if (!supplierProfile) {
            return NextResponse.json({ message: "Supplier profile not found" }, { status: 404 })
        }

        const connections = await prisma.connection.findMany({
            where: {
                supplierId: supplierProfile.id
            },
            include: {
                store: {
                    select: {
                        id: true,
                        businessName: true,
                        shopifyDomain: true,
                        shopifyStoreName: true,
                        user: {
                            select: {
                                name: true,
                                email: true
                            }
                        }
                    }
                }
            },
            orderBy: {
                createdAt: "desc"
            }
        })

        // Include pending invitations so supplier sees new invites immediately
        const pendingInvitations = await prisma.invitation.findMany({
            where: {
                supplierId: supplierProfile.id,
                used: false,
                expiresAt: {
                    gt: new Date()
                }
            },
            include: {
                store: {
                    select: {
                        id: true,
                        businessName: true,
                        shopifyDomain: true,
                        shopifyStoreName: true,
                        user: {
                            select: {
                                name: true,
                                email: true
                            }
                        }
                    }
                }
            },
            orderBy: {
                createdAt: "desc"
            }
        })

        type ConnectionRow = (typeof connections)[number]
        type InvitationRow = (typeof pendingInvitations)[number]

        const connectionStoreIds = new Set(
            connections.map((c: ConnectionRow) => c.store.id)
        )

        // If a real connection already exists for a store, hide pending invitation for that same store.
        const pendingAsConnections = pendingInvitations
            .filter((inv: InvitationRow) => !connectionStoreIds.has(inv.store.id))
            .map((inv: InvitationRow) => ({
                id: inv.id,
                status: "PENDING" as const,
                createdAt: inv.createdAt,
                store: inv.store,
                invitationToken: inv.token,
                invitationExpiresAt: inv.expiresAt,
            }))

        const allConnections = [...connections, ...pendingAsConnections].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )

        return NextResponse.json({ connections: allConnections })
    } catch (error) {
        console.error("Error fetching vendor connections:", error)
        return NextResponse.json(
            { message: "Failed to fetch vendor connections" },
            { status: 500 }
        )
    }
}
