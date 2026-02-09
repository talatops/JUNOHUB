import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { handleApiError } from "@/lib/errors"

export async function GET() {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        // Check if user has a Gmail integration connected
        const gmailIntegration = await prisma.gmailIntegration.findUnique({
            where: {
                userId: session.user.id
            }
        })

        // Check if token is expired
        const isExpired = gmailIntegration && gmailIntegration.expiresAt < new Date()

        return NextResponse.json({
            connected: !!gmailIntegration && !isExpired,
            email: gmailIntegration?.email || null,
            expiresAt: gmailIntegration?.expiresAt || null
        })
    } catch (error) {
        return handleApiError(error, "gmail-status")
    }
}
