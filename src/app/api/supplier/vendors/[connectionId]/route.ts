import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { supplierConnectionStatusSchema, validationErrorResponse } from "@/lib/api-schemas"

/**
 * GET /api/supplier/vendors/[connectionId]
 * Get a single vendor connection with store details for the authenticated supplier
 */
export async function GET(
    req: Request,
    { params }: { params: Promise<{ connectionId: string }> }
) {
    try {
        const session = await auth()

        if (!session?.user?.id || session.user.role !== "SUPPLIER") {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        const { connectionId } = await params

        const supplierProfile = await prisma.supplierProfile.findUnique({
            where: { userId: session.user.id }
        })

        if (!supplierProfile) {
            return NextResponse.json({ message: "Supplier profile not found" }, { status: 404 })
        }

        const connection = await prisma.connection.findFirst({
            where: {
                id: connectionId,
                supplierId: supplierProfile.id
            },
            include: {
                store: {
                    select: {
                        id: true,
                        businessName: true,
                        shopifyDomain: true,
                        shopifyStoreName: true,
                        email: true,
                        user: {
                            select: {
                                name: true,
                                email: true
                            }
                        }
                    }
                }
            }
        })

        if (!connection) {
            return NextResponse.json({ message: "Connection not found" }, { status: 404 })
        }

        return NextResponse.json({ connection })
    } catch (error) {
        console.error("Error fetching vendor connection:", error)
        return NextResponse.json(
            { message: "Failed to fetch vendor connection" },
            { status: 500 }
        )
    }
}

/**
 * PUT /api/supplier/vendors/[connectionId]
 * Update connection status (accept/reject)
 */
export async function PUT(
    req: Request,
    { params }: { params: Promise<{ connectionId: string }> }
) {
    try {
        const session = await auth()

        if (!session?.user?.id || session.user.role !== "SUPPLIER") {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        const { connectionId } = await params
        const raw = await req.json().catch(() => ({}))
        const parsed = supplierConnectionStatusSchema.safeParse(raw)
        if (!parsed.success) {
            return validationErrorResponse(parsed.error)
        }
        const { status } = parsed.data

        // Get supplier profile
        const supplierProfile = await prisma.supplierProfile.findUnique({
            where: { userId: session.user.id }
        })

        if (!supplierProfile) {
            return NextResponse.json({ message: "Supplier profile not found" }, { status: 404 })
        }

        // First try normal connection update flow
        const connection = await prisma.connection.findFirst({
            where: {
                id: connectionId,
                supplierId: supplierProfile.id
            }
        })

        if (connection) {
            const updatedConnection = await prisma.connection.update({
                where: { id: connectionId },
                data: { status: status as "CONNECTED" | "REJECTED" }
            })

            return NextResponse.json({
                message: `Connection ${status.toLowerCase()} successfully`,
                connection: updatedConnection
            })
        }

        // If not a connection, try treating `connectionId` as a pending invitation id.
        const invitation = await prisma.invitation.findFirst({
            where: {
                id: connectionId,
                supplierId: supplierProfile.id,
                used: false,
                expiresAt: {
                    gt: new Date()
                }
            }
        })

        if (!invitation) {
            return NextResponse.json({ message: "Connection or invitation not found" }, { status: 404 })
        }

        if (status === "CONNECTED") {
            // Accept invitation: mark used and create connection in one transaction.
            const createdConnection = await prisma.$transaction(async (tx) => {
                await tx.invitation.update({
                    where: { id: invitation.id },
                    data: {
                        used: true,
                        usedAt: new Date()
                    }
                })

                return tx.connection.upsert({
                    where: {
                        storeId_supplierId: {
                            storeId: invitation.storeId,
                            supplierId: invitation.supplierId
                        }
                    },
                    update: {
                        status: "CONNECTED"
                    },
                    create: {
                        storeId: invitation.storeId,
                        supplierId: invitation.supplierId,
                        status: "CONNECTED"
                    }
                })
            })

            return NextResponse.json({
                message: "Invitation accepted successfully",
                connection: createdConnection
            })
        }

        // Reject invitation: consume it so it disappears from pending list.
        await prisma.invitation.update({
            where: { id: invitation.id },
            data: {
                used: true,
                usedAt: new Date()
            }
        })

        return NextResponse.json({
            message: "Invitation rejected successfully"
        })
    } catch (error) {
        console.error("Error updating connection:", error)
        return NextResponse.json(
            { message: "Failed to update connection" },
            { status: 500 }
        )
    }
}

/**
 * DELETE /api/supplier/vendors/[connectionId]
 * Delete a connection
 */
export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ connectionId: string }> }
) {
    try {
        const session = await auth()

        if (!session?.user?.id || session.user.role !== "SUPPLIER") {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        const { connectionId } = await params

        // Get supplier profile
        const supplierProfile = await prisma.supplierProfile.findUnique({
            where: { userId: session.user.id }
        })

        if (!supplierProfile) {
            return NextResponse.json({ message: "Supplier profile not found" }, { status: 404 })
        }

        // Verify connection belongs to supplier
        const connection = await prisma.connection.findFirst({
            where: {
                id: connectionId,
                supplierId: supplierProfile.id
            }
        })

        if (!connection) {
            return NextResponse.json({ message: "Connection not found" }, { status: 404 })
        }

        await prisma.connection.delete({
            where: { id: connectionId }
        })

        return NextResponse.json({
            message: "Connection deleted successfully"
        })
    } catch (error) {
        console.error("Error deleting connection:", error)
        return NextResponse.json(
            { message: "Failed to delete connection" },
            { status: 500 }
        )
    }
}
