import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { storeSwitchSchema, validationErrorResponse } from "@/lib/api-schemas"

/**
 * POST /api/stores/switch
 * Switch the active store for the user
 */
export async function POST(request: Request) {
    try {
        const session = await auth()

        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        const raw = await request.json().catch(() => ({}))
        const parsed = storeSwitchSchema.safeParse(raw)
        if (!parsed.success) {
            return validationErrorResponse(parsed.error)
        }
        const { storeId } = parsed.data

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

        // Set all stores to inactive
        await prisma.store.updateMany({
            where: {
                userId: session.user.id
            },
            data: {
                isActive: false
            }
        })

        // Set the selected store as active
        await prisma.store.update({
            where: {
                id: storeId
            },
            data: {
                isActive: true
            }
        })

        // Update user's activeStoreId
        await prisma.user.update({
            where: {
                id: session.user.id
            },
            data: {
                activeStoreId: storeId
            }
        })

        return NextResponse.json({
            success: true,
            activeStoreId: storeId
        })
    } catch (error) {
        console.error("Error switching store:", error)
        return NextResponse.json(
            { message: "Failed to switch store" },
            { status: 500 }
        )
    }
}
