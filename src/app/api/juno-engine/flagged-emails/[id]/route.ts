import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

async function getActiveStoreId(userId: string): Promise<string | null> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
            stores: {
                where: { isActive: true },
                take: 1,
                select: { id: true },
            },
        },
    })
    return user?.stores[0]?.id ?? null
}

export async function DELETE(
    _req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }
        if (session.user.role !== "VENDOR") {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 })
        }

        const storeId = await getActiveStoreId(session.user.id)
        if (!storeId) {
            return NextResponse.json({ message: "No active store found" }, { status: 400 })
        }

        const { id } = await params
        await prisma.flaggedEmail.deleteMany({
            where: { id, storeId },
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("[FLAGGED_EMAILS_DELETE]", error)
        return NextResponse.json(
            { message: "Failed to delete flagged email" },
            { status: 500 }
        )
    }
}
