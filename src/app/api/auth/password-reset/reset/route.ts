import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { passwordSchema, emailSchema } from "@/lib/validation"
import { applyRateLimit } from "@/lib/rate-limit"
import { handleApiError } from "@/lib/errors"
import bcrypt from "bcryptjs"

export async function POST(req: Request) {
    try {
        const rate = await applyRateLimit(req, "auth:password-reset")
        if (!rate.success) {
            return NextResponse.json(
                { message: "Too many requests. Please try again later." },
                { status: 429 }
            )
        }

        const body = await req.json()
        const { token, email, password } = body

        if (!token || !email || !password) {
            return NextResponse.json(
                { message: "Token, email, and password are required" },
                { status: 400 }
            )
        }

        // Validate email and password
        const emailResult = emailSchema.safeParse(email)
        const passwordResult = passwordSchema.safeParse(password)

        if (!emailResult.success) {
            return NextResponse.json(
                { message: emailResult.error.errors[0].message },
                { status: 400 }
            )
        }

        if (!passwordResult.success) {
            return NextResponse.json(
                { message: passwordResult.error.errors[0].message },
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
                { message: "Invalid or expired reset token" },
                { status: 400 }
            )
        }

        // Update password
        const hashedPassword = await bcrypt.hash(password, 10)
        await prisma.user.update({
            where: { email },
            data: { password: hashedPassword }
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
            message: "Password has been reset successfully"
        })
    } catch (error) {
        return handleApiError(error, "password-reset")
    }
}
