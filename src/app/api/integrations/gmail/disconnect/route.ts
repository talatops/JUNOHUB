import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { handleApiError } from "@/lib/errors"

export async function POST() {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        // Delete Gmail integration
        await prisma.gmailIntegration.deleteMany({
            where: {
                userId: session.user.id
            }
        })

        return NextResponse.json({
            message: "Gmail disconnected successfully"
        })
    } catch (error) {
        return handleApiError(error, "gmail-disconnect")
    }
}
