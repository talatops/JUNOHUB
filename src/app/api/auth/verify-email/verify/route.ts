import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { applyRateLimit } from "@/lib/rate-limit"
import { handleApiError } from "@/lib/errors"
import { authVerifyEmailBodySchema, validationErrorResponse } from "@/lib/api-schemas"

export async function POST(req: Request) {
    try {
        const rate = await applyRateLimit(req, "auth:verify-email")
        if (!rate.success) {
            return NextResponse.json(
                { message: "Too many requests. Please try again later." },
                { status: 429 }
            )
        }

        const raw = await req.json().catch(() => ({}))
        const parsed = authVerifyEmailBodySchema.safeParse(raw)
        if (!parsed.success) {
            return validationErrorResponse(parsed.error)
        }
        const { token, email } = parsed.data

        // Verify token
        const verificationToken = await prisma.verificationToken.findUnique({
            where: {
                identifier_token: {
                    identifier: email,
                    token: token
                }
            }
        })

        if (!verificationToken || verificationToken.expires < new Date()) {
            return NextResponse.json(
                { message: "Invalid or expired verification token" },
                { status: 400 }
            )
        }

        // Update user emailVerified
        await prisma.user.update({
            where: { email },
            data: { emailVerified: new Date() }
        })

        // Delete used token
        await prisma.verificationToken.delete({
            where: {
                identifier_token: {
                    identifier: email,
                    token: token
                }
            }
        })

        return NextResponse.json({
            message: "Email verified successfully"
        })
    } catch (error) {
        return handleApiError(error, "verify-email")
    }
}
