import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

/**
 * PUT /api/products/sync/[syncId]
 * Accept or reject a product sync request
 */
export async function PUT(
    req: Request,
    { params }: { params: Promise<{ syncId: string }> }
) {
    try {
        const session = await auth()

        if (!session?.user?.id || session.user.role !== "SUPPLIER") {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        const { syncId } = await params
        const body = await req.json()
        const { action } = body // "accept" or "reject"

        if (!action || !["accept", "reject"].includes(action)) {
            return NextResponse.json(
                { message: "Invalid action. Use 'accept' or 'reject'" },
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

        // Find sync request
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const productSync = await (prisma as any).productSync.findUnique({
            where: { id: syncId },
            include: {
                store: {
                    select: {
                        id: true,
                        businessName: true,
                        userId: true
                    }
                }
            }
        })

        if (!productSync) {
            return NextResponse.json(
                { message: "Product sync request not found" },
                { status: 404 }
            )
        }

        // Verify sync belongs to this supplier
        if (productSync.supplierId !== supplierProfile.id) {
            return NextResponse.json(
                { message: "Unauthorized - this sync request is not for you" },
                { status: 403 }
            )
        }

        // Verify sync is pending
        if (productSync.status !== "PENDING") {
            return NextResponse.json(
                { message: `This sync request has already been ${productSync.status.toLowerCase()}` },
                { status: 400 }
            )
        }

        // Update sync status
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updateData: any = {
            status: action === "accept" ? "ACCEPTED" : "REJECTED"
        }

        if (action === "accept") {
            updateData.acceptedAt = new Date()
        } else {
            updateData.rejectedAt = new Date()
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (prisma as any).productSync.update({
            where: { id: syncId },
            data: updateData
        })

        // Create notification for vendor
        try {
            const { notifyProductSyncStatusChanged } = await import("@/lib/notifications")
            await notifyProductSyncStatusChanged(
                productSync.store.userId,
                supplierProfile.companyName,
                productSync.shopifyProductTitle,
                action === "accept" ? "ACCEPTED" : "REJECTED",
                productSync.id
            )
        } catch (notifError) {
            console.error("Error creating notification:", notifError)
            // Don't fail the request if notification fails
        }

        return NextResponse.json({
            message: `Product sync request ${action === "accept" ? "accepted" : "rejected"} successfully`,
            sync: {
                ...productSync,
                status: action === "accept" ? "ACCEPTED" : "REJECTED"
            }
        })
    } catch (error) {
        console.error("Error updating product sync:", error)
        return NextResponse.json(
            { message: "Failed to update product sync" },
            { status: 500 }
        )
    }
}

/**
 * DELETE /api/products/sync/[syncId]
 * Cancel/delete a product sync request
 */
export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ syncId: string }> }
) {
    try {
        const session = await auth()

        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        const { syncId } = await params

        // Find sync request
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const productSync = await (prisma as any).productSync.findUnique({
            where: { id: syncId },
            include: {
                store: {
                    select: {
                        userId: true
                    }
                }
            }
        })

        if (!productSync) {
            return NextResponse.json(
                { message: "Product sync request not found" },
                { status: 404 }
            )
        }

        // Verify user owns the sync (vendor who requested or supplier who received)
        const isVendor = productSync.store.userId === session.user.id
        const isSupplier = session.user.role === "SUPPLIER"
        
        if (!isVendor && !isSupplier) {
            return NextResponse.json(
                { message: "Unauthorized" },
                { status: 403 }
            )
        }

        // Only vendor can delete pending requests, supplier should reject instead
        if (isSupplier && productSync.status === "PENDING") {
            return NextResponse.json(
                { message: "Please reject the request instead of deleting it" },
                { status: 400 }
            )
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (prisma as any).productSync.delete({
            where: { id: syncId }
        })

        return NextResponse.json({ message: "Product sync request deleted successfully" })
    } catch (error) {
        console.error("Error deleting product sync:", error)
        return NextResponse.json(
            { message: "Failed to delete product sync" },
            { status: 500 }
        )
    }
}
