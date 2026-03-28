import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { isVendorPortalRole } from "@/lib/auth-roles"
import { prisma } from "@/lib/prisma"

/**
 * GET /api/vendors/suppliers
 * List all suppliers globally (for vendors to discover)
 */
export async function GET() {
    try {
        const session = await auth()

        if (!session?.user?.id || !isVendorPortalRole(session.user.role)) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        // Get all supplier profiles with their user info and product counts
        const suppliers = await prisma.supplierProfile.findMany({
            select: {
                id: true,
                companyName: true,
                description: true,
                createdAt: true,
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                },
                _count: {
                    select: {
                        products: true,
                        connections: true
                    }
                }
            },
            orderBy: {
                createdAt: "desc"
            }
        })

        // Get vendor's store to check existing connections
        const vendorStore = await prisma.store.findFirst({
            where: {
                userId: session.user.id,
                isActive: true
            }
        })

        type SupplierListRow = (typeof suppliers)[number]

        // Mark which suppliers are already connected/pending
        const suppliersWithStatus = await Promise.all(
            suppliers.map(async (supplier: SupplierListRow) => {
                let connectionStatus: "NONE" | "PENDING" | "CONNECTED" | "REJECTED" = "NONE"
                
                if (vendorStore) {
                    // First check for existing connection
                    const connection = await prisma.connection.findUnique({
                        where: {
                            storeId_supplierId: {
                                storeId: vendorStore.id,
                                supplierId: supplier.id
                            }
                        },
                        select: {
                            status: true
                        }
                    })
                    
                    if (connection) {
                        connectionStatus = connection.status as "PENDING" | "CONNECTED" | "REJECTED"
                    } else {
                        // Check for pending invitation (not yet accepted)
                        const pendingInvitation = await prisma.invitation.findFirst({
                            where: {
                                storeId: vendorStore.id,
                                supplierId: supplier.id,
                                used: false,
                                expiresAt: {
                                    gt: new Date()
                                }
                            }
                        })
                        
                        if (pendingInvitation) {
                            connectionStatus = "PENDING"
                        }
                    }
                }

                return {
                    ...supplier,
                    connectionStatus
                }
            })
        )

        return NextResponse.json({ suppliers: suppliersWithStatus })
    } catch (error) {
        console.error("Error fetching suppliers:", error)
        return NextResponse.json(
            { message: "Failed to fetch suppliers" },
            { status: 500 }
        )
    }
}
