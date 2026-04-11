import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verify } from "otplib"
import { decryptString } from "@/lib/encryption"
import { applyRateLimit } from "@/lib/rate-limit"
import { authVerifyMfaSchema, validationErrorResponse } from "@/lib/api-schemas"

export async function POST(req: Request) {
    try {
        const raw = await req.json().catch(() => ({}))
        const parsed = authVerifyMfaSchema.safeParse(raw)
        if (!parsed.success) {
            return validationErrorResponse(parsed.error)
        }
        const { email, code } = parsed.data

        // Rate limit MFA verification attempts per IP
        const rate = await applyRateLimit(req, "auth:mfa-verify")
        if (!rate.success) {
            return NextResponse.json(
                { message: "Too many verification attempts. Please try again later." },
                { status: 429 }
            )
        }

        // Use raw query to access MFA fields until Prisma client is fully regenerated
        const userResult = await prisma.$queryRaw<
            Array<{ mfaEnabled: boolean | null; mfaSecret: string | null }>
        >`SELECT "mfaEnabled", "mfaSecret" FROM "User" WHERE email = ${email}`

        if (!userResult || userResult.length === 0) {
            return NextResponse.json(
                { message: "User not found" },
                { status: 404 }
            )
        }

        const user = userResult[0]
        const mfaEnabled = user.mfaEnabled ?? false
        const mfaSecret = decryptString(user.mfaSecret)

        if (!mfaEnabled || !mfaSecret) {
            return NextResponse.json(
                { message: "MFA is not enabled for this account" },
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

        return NextResponse.json({
            message: "MFA verification successful",
            verified: true
        })
    } catch (error) {
        console.error("MFA verification error:", error)
        return NextResponse.json(
            { message: "Internal server error" },
            { status: 500 }
        )
    }
}
