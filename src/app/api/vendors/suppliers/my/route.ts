import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { isVendorPortalRole } from "@/lib/auth-roles"
import { prisma } from "@/lib/prisma"

/**
 * GET /api/vendors/suppliers/my
 * List connected suppliers for the authenticated vendor
 */
export async function GET() {
    try {
        const session = await auth()

        if (!session?.user?.id || !isVendorPortalRole(session.user.role)) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        // Get vendor's stores
        const vendorStores = await prisma.store.findMany({
            where: {
                userId: session.user.id,
                onboardingComplete: true
            }
        })

        if (vendorStores.length === 0) {
            return NextResponse.json({ connections: [] })
        }

        // Get all connections for this vendor's stores
        type VendorStoreRow = (typeof vendorStores)[number]
        const vendorStoreIds = vendorStores.map((s: VendorStoreRow) => s.id)
        const connections = await prisma.connection.findMany({
            where: {
                storeId: { in: vendorStoreIds }
            },
            include: {
                store: {
                    select: {
                        id: true,
                        businessName: true,
                        isActive: true
                    }
                },
                supplier: {
                    select: {
                        id: true,
                        companyName: true,
                        description: true,
                        user: {
                            select: {
                                name: true,
                                email: true
                            }
                        },
                        _count: {
                            select: {
                                products: true
                            }
                        }
                    }
                }
            },
            orderBy: {
                createdAt: "desc"
            }
        })

        // Get pending invitations (not yet accepted - no connection created)
        const pendingInvitations = await prisma.invitation.findMany({
            where: {
                storeId: { in: vendorStoreIds },
                used: false,
                expiresAt: {
                    gt: new Date()
                }
            },
            include: {
                supplier: {
                    select: {
                        id: true,
                        companyName: true,
                        description: true,
                        user: {
                            select: {
                                name: true,
                                email: true
                            }
                        },
                        _count: {
                            select: {
                                products: true
                            }
                        }
                    }
                }
            },
            orderBy: {
                createdAt: "desc"
            }
        })

        type PendingInvitationRow = (typeof pendingInvitations)[number]
        type ConnectionRow = (typeof connections)[number]

        // Convert invitations to connection-like objects with PENDING status
        const pendingConnections = pendingInvitations.map((invitation: PendingInvitationRow) => ({
            id: invitation.id, // Use invitation ID as temporary connection ID
            status: "PENDING" as const,
            createdAt: invitation.createdAt,
            supplier: invitation.supplier,
            store: {
                id: invitation.storeId,
                businessName:
                    vendorStores.find((s: VendorStoreRow) => s.id === invitation.storeId)?.businessName ||
                    "Unknown Store",
                isActive:
                    vendorStores.find((s: VendorStoreRow) => s.id === invitation.storeId)?.isActive || false,
            },
        }))

        type PendingConnectionRow = (typeof pendingConnections)[number]

        // Combine connections and pending invitations, removing duplicates
        // (if a connection exists, don't include the invitation)
        const connectionSupplierIds = new Set(
            connections.map((c: ConnectionRow) => c.supplier.id)
        )
        const uniquePendingConnections = pendingConnections.filter(
            (pc: PendingConnectionRow) => !connectionSupplierIds.has(pc.supplier.id)
        )

        const allConnections = [...connections, ...uniquePendingConnections].sort(
            (a: ConnectionRow | PendingConnectionRow, b: ConnectionRow | PendingConnectionRow) =>
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )

        return NextResponse.json({ connections: allConnections })
    } catch (error) {
        console.error("Error fetching my suppliers:", error)
        return NextResponse.json(
            { message: "Failed to fetch suppliers" },
            { status: 500 }
        )
    }
}
