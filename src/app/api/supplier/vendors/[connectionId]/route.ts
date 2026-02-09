import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

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
        const { status } = await req.json()

        if (!status || !["CONNECTED", "REJECTED"].includes(status)) {
            return NextResponse.json(
                { message: "Valid status (CONNECTED or REJECTED) is required" },
                { status: 400 }
            )
        }

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

        const updatedConnection = await prisma.connection.update({
            where: { id: connectionId },
            data: { status: status as "CONNECTED" | "REJECTED" }
        })

        return NextResponse.json({
            message: `Connection ${status.toLowerCase()} successfully`,
            connection: updatedConnection
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
