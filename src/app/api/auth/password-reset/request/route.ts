import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendEmail } from "@/lib/email"
import { emailSchema } from "@/lib/validation"
import { applyRateLimit } from "@/lib/rate-limit"
import { handleApiError } from "@/lib/errors"
import { getBaseUrl } from "@/lib/utils"
import crypto from "crypto"

export async function POST(req: Request) {
    try {
        const rate = await applyRateLimit(req, "auth:password-reset-request")
        if (!rate.success) {
            return NextResponse.json(
                { message: "Too many requests. Please try again later." },
                { status: 429 }
            )
        }

        const body = await req.json()
        const emailResult = emailSchema.safeParse(body.email)

        if (!emailResult.success) {
            return NextResponse.json(
                { message: emailResult.error.errors[0].message },
                { status: 400 }
            )
        }

        const email = emailResult.data

        const user = await prisma.user.findUnique({
            where: { email }
        })

        // Don't reveal if user exists or not (security best practice)
        if (!user) {
            return NextResponse.json({
                message: "If an account with that email exists, a password reset link has been sent."
            })
        }

        // Generate reset token
        const resetToken = crypto.randomBytes(32).toString("hex")
        const expiresAt = new Date()
        expiresAt.setHours(expiresAt.getHours() + 1) // Token expires in 1 hour

        // Store token in VerificationToken table
        await prisma.verificationToken.upsert({
            where: {
                identifier_token: {
                    identifier: email,
                    token: resetToken
                }
            },
            update: {
                token: resetToken,
                expires: expiresAt
            },
            create: {
                identifier: email,
                token: resetToken,
                expires: expiresAt
            }
        })

        // Send reset email
        const resetUrl = `${getBaseUrl()}/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`

        const emailHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Password Reset - JUNOHUB</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0e1a;">
    <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
            <td style="padding: 40px 20px; text-align: center;">
                <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #1e293b; border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.1); overflow: hidden;">
                    <tr>
                        <td style="padding: 40px;">
                            <h2 style="margin: 0 0 16px; font-size: 24px; font-weight: 700; color: #ffffff;">Reset Your Password</h2>
                            <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #cbd5e1;">
                                Click the button below to reset your password. This link will expire in 1 hour.
                            </p>
                            <a href="${resetUrl}" style="display: inline-block; padding: 14px 32px; background-color: #4f46e5; color: #ffffff; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 16px;">
                                Reset Password
                            </a>
                            <p style="margin: 24px 0 0; font-size: 14px; color: #94a3b8;">
                                If you didn't request this, you can safely ignore this email.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
        `

        await sendEmail({
            to: email,
            subject: "Reset Your JUNOHUB Password",
            html: emailHtml
        })

        return NextResponse.json({
            message: "If an account with that email exists, a password reset link has been sent."
        })
    } catch (error) {
        return handleApiError(error, "password-reset-request")
    }
}
