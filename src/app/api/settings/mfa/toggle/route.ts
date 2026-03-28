import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { decryptString } from "@/lib/encryption"

export async function POST(req: Request) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        const { enabled } = await req.json()

        // Use raw query to check mfaSecret until Prisma client is fully regenerated
        const result = await prisma.$queryRaw<
            Array<{ mfaSecret: string | null }>
        >`SELECT "mfaSecret" FROM "User" WHERE id = ${session.user.id}`

        if (!result || result.length === 0) {
            return NextResponse.json({ message: "User not found" }, { status: 404 })
        }

        const storedSecret = result[0].mfaSecret
        const mfaSecret = decryptString(storedSecret)
        if (enabled && !mfaSecret) {
            return NextResponse.json(
                { message: "Please set up MFA first by generating a secret and verifying it." },
                { status: 400 }
            )
        }

        // Disable MFA (can be done without verification)
        if (!enabled) {
            await prisma.$executeRaw`UPDATE "User" SET "mfaEnabled" = false WHERE id = ${session.user.id}`

            return NextResponse.json({
                message: "MFA disabled successfully",
                enabled: false
            })
        }

        // Enabling requires verification (handled by verify endpoint)
        return NextResponse.json(
            { message: "Please verify your code first using the verify endpoint" },
            { status: 400 }
        )
    } catch (error) {
        console.error("MFA toggle error:", error)
        return NextResponse.json(
            { message: "Internal server error" },
            { status: 500 }
        )
    }
}
