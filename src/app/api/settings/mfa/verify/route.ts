import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { verify } from "otplib"
import { decryptString } from "@/lib/encryption"
import { applyRateLimit } from "@/lib/rate-limit"
import { mfaSetupVerifySchema, validationErrorResponse } from "@/lib/api-schemas"

export async function POST(req: Request) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        const raw = await req.json().catch(() => ({}))
        const parsed = mfaSetupVerifySchema.safeParse(raw)
        if (!parsed.success) {
            return validationErrorResponse(parsed.error)
        }
        const { code } = parsed.data

        // Rate limit MFA setup verification attempts per IP
        const rate = await applyRateLimit(req, "settings:mfa-verify")
        if (!rate.success) {
            return NextResponse.json(
                { message: "Too many verification attempts. Please try again later." },
                { status: 429 }
            )
        }

        // Use raw query to access mfaSecret until Prisma client is fully regenerated
        const userResult = await prisma.$queryRaw<Array<{ mfaSecret: string | null }>>`SELECT "mfaSecret" FROM "User" WHERE id = ${session.user.id}`

        if (!userResult || userResult.length === 0) {
            return NextResponse.json(
                { message: "User not found" },
                { status: 404 }
            )
        }

        const storedSecret = userResult[0].mfaSecret
        const mfaSecret = decryptString(storedSecret)
        if (!mfaSecret) {
            return NextResponse.json(
                { message: "MFA secret not found. Please set up MFA first." },
                { status: 400 }
            )
        }

        // Verify the TOTP code
        const verifyResult = await verify({ token: code, secret: mfaSecret })
        const isValid = verifyResult.valid ?? false

        if (!isValid) {
            return NextResponse.json(
                { message: "Invalid verification code" },
                { status: 400 }
            )
        }

        // Enable MFA
        await prisma.$executeRaw`UPDATE "User" SET "mfaEnabled" = true WHERE id = ${session.user.id}`

        return NextResponse.json({
            message: "MFA enabled successfully",
            enabled: true
        })
    } catch (error) {
        console.error("MFA verify error:", error)
        return NextResponse.json(
            { message: "Internal server error" },
            { status: 500 }
        )
    }
}
