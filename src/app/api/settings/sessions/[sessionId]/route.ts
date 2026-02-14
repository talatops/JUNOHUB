import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ sessionId: string }> }
) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        const { sessionId } = await params

        // Verify the session belongs to the user
        const userSession = await prisma.session.findFirst({
            where: {
                id: sessionId,
                userId: session.user.id
            }
        })

        if (!userSession) {
            return NextResponse.json({ message: "Session not found" }, { status: 404 })
        }

        // Delete the session
        await prisma.session.delete({
            where: { id: sessionId }
        })

        return NextResponse.json({ message: "Session revoked successfully" })
    } catch (error) {
        console.error("Revoke session error:", error)
        return NextResponse.json(
            { message: "Internal server error" },
            { status: 500 }
        )
    }
}
