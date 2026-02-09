import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { decryptString } from "@/lib/encryption"
import { logger } from "@/lib/logger"

export async function GET() {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        // Use raw query to access MFA fields until Prisma client is fully regenerated
        const result = await prisma.$queryRawUnsafe<Array<{ mfaEnabled: boolean | null; mfaSecret: string | null }>>(
            `SELECT "mfaEnabled", "mfaSecret" FROM "User" WHERE id = $1`,
            session.user.id
        )

        if (!result || result.length === 0) {
            return NextResponse.json({ message: "User not found" }, { status: 404 })
        }

        const user = result[0]
        const hasSecret = !!decryptString(user.mfaSecret)
        return NextResponse.json({
            enabled: user.mfaEnabled ?? false,
            hasSecret
        })
    } catch (error) {
        logger.error("MFA status error", error)
        const errorMessage = error instanceof Error ? error.message : "Unknown error"
        const errorStack = error instanceof Error ? error.stack : undefined
        logger.error("MFA status error details", { errorMessage, errorStack })
        return NextResponse.json(
            { message: "Internal server error", error: errorMessage },
            { status: 500 }
        )
    }
}
