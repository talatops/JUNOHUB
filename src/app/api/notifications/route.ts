import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { notificationsMarkReadSchema } from "@/lib/api-schemas/vendorMutations"
import { validationErrorResponse } from "@/lib/api-schemas/validate"

/**
 * GET /api/notifications
 * Get all notifications for the authenticated user
 */
export async function GET(req: Request) {
    try {
        const session = await auth()

        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        const { searchParams } = new URL(req.url)
        const unreadOnly = searchParams.get("unread") === "true"
        const limit = parseInt(searchParams.get("limit") || "50")

        const notifications = await prisma.notification.findMany({
            where: {
                userId: session.user.id,
                ...(unreadOnly && { read: false })
            },
            orderBy: {
                createdAt: "desc"
            },
            take: limit
        })

        const unreadCount = await prisma.notification.count({
            where: {
                userId: session.user.id,
                read: false
            }
        })

        return NextResponse.json({
            notifications,
            unreadCount
        })
    } catch (error) {
        console.error("Error fetching notifications:", error)
        return NextResponse.json(
            { message: "Failed to fetch notifications" },
            { status: 500 }
        )
    }
}

/**
 * POST /api/notifications
 * Mark notifications as read
 */
export async function POST(req: Request) {
    try {
        const session = await auth()

        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        const raw = await req.json().catch(() => ({}))
        const parsed = notificationsMarkReadSchema.safeParse(raw)
        if (!parsed.success) {
            return validationErrorResponse(parsed.error)
        }
        const { notificationIds, markAllAsRead } = parsed.data

        if (markAllAsRead) {
            // Mark all notifications as read for this user
            await prisma.notification.updateMany({
                where: {
                    userId: session.user.id,
                    read: false
                },
                data: {
                    read: true,
                    readAt: new Date()
                }
            })

            return NextResponse.json({ message: "All notifications marked as read" })
        }

        if (notificationIds && notificationIds.length > 0) {
            await prisma.notification.updateMany({
                where: {
                    id: { in: notificationIds },
                    userId: session.user.id,
                },
                data: {
                    read: true,
                    readAt: new Date(),
                },
            })

            return NextResponse.json({ message: "Notifications marked as read" })
        }

        return NextResponse.json({ message: "Invalid request" }, { status: 400 })
    } catch (error) {
        console.error("Error updating notifications:", error)
        return NextResponse.json(
            { message: "Failed to update notifications" },
            { status: 500 }
        )
    }
}
