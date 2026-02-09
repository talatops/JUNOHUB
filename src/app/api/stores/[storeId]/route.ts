import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

/**
 * DELETE /api/stores/[storeId]
 * Delete a store for the authenticated user
 */
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ storeId: string }> }
) {
    try {
        const session = await auth()

        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        const { storeId } = await params

        if (!storeId) {
            return NextResponse.json({ message: "Store ID is required" }, { status: 400 })
        }

        // Verify the store belongs to the user
        const store = await prisma.store.findFirst({
            where: {
                id: storeId,
                userId: session.user.id
            }
        })

        if (!store) {
            return NextResponse.json({ message: "Store not found" }, { status: 404 })
        }

        // Check if this is the only store
        const storeCount = await prisma.store.count({
            where: { userId: session.user.id }
        })

        if (storeCount === 1) {
            return NextResponse.json({
                message: "Cannot delete your only store. Please add another store first."
            }, { status: 400 })
        }

        // If deleting the active store, switch to another store first
        if (store.isActive) {
            const otherStore = await prisma.store.findFirst({
                where: {
                    userId: session.user.id,
                    id: { not: storeId }
                },
                orderBy: {
                    createdAt: "desc"
                }
            })

            if (otherStore) {
                // Switch to another store
                await prisma.store.updateMany({
                    where: {
                        userId: session.user.id
                    },
                    data: {
                        isActive: false
                    }
                })

                await prisma.store.update({
                    where: { id: otherStore.id },
                    data: { isActive: true }
                })

                await prisma.user.update({
                    where: { id: session.user.id },
                    data: { activeStoreId: otherStore.id }
                })
            }
        }

        // Delete the store (cascade will handle related data)
        await prisma.store.delete({
            where: { id: storeId }
        })

        return NextResponse.json({
            success: true,
            message: "Store deleted successfully"
        })
    } catch (error) {
        console.error("Error deleting store:", error)
        return NextResponse.json(
            { message: "Failed to delete store" },
            { status: 500 }
        )
    }
}
