import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { applyRateLimit } from "@/lib/rate-limit"
import { handleApiError } from "@/lib/errors"

export async function POST(req: Request) {
    try {
        const rate = await applyRateLimit(req, "auth:verify-email")
        if (!rate.success) {
            return NextResponse.json(
                { message: "Too many requests. Please try again later." },
                { status: 429 }
            )
        }

        const body = await req.json()
        const { token, email } = body

        if (!token || !email) {
            return NextResponse.json(
                { message: "Token and email are required" },
                { status: 400 }
            )
        }

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
