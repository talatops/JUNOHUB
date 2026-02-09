import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

/**
 * PUT /api/notifications/[notificationId]
 * Mark a specific notification as read
 */
export async function PUT(
    req: Request,
    { params }: { params: Promise<{ notificationId: string }> }
) {
    try {
        const session = await auth()

        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        const { notificationId } = await params

        // Verify notification belongs to user
        const notification = await prisma.notification.findFirst({
            where: {
                id: notificationId,
                userId: session.user.id
            }
        })

        if (!notification) {
            return NextResponse.json({ message: "Notification not found" }, { status: 404 })
        }

        // Mark as read
        await prisma.notification.update({
            where: { id: notificationId },
            data: {
                read: true,
                readAt: new Date()
            }
        })

        return NextResponse.json({ message: "Notification marked as read" })
    } catch (error) {
        console.error("Error updating notification:", error)
        return NextResponse.json(
            { message: "Failed to update notification" },
            { status: 500 }
        )
    }
}

/**
 * DELETE /api/notifications/[notificationId]
 * Delete a notification
 */
export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ notificationId: string }> }
) {
    try {
        const session = await auth()

        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        const { notificationId } = await params

        // Verify notification belongs to user
        const notification = await prisma.notification.findFirst({
            where: {
                id: notificationId,
                userId: session.user.id
            }
        })

        if (!notification) {
            return NextResponse.json({ message: "Notification not found" }, { status: 404 })
        }

        await prisma.notification.delete({
            where: { id: notificationId }
        })

        return NextResponse.json({ message: "Notification deleted" })
    } catch (error) {
        console.error("Error deleting notification:", error)
        return NextResponse.json(
            { message: "Failed to delete notification" },
            { status: 500 }
        )
    }
}
