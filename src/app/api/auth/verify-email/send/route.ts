import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { sendEmail } from "@/lib/email"
import { applyRateLimit } from "@/lib/rate-limit"
import { handleApiError } from "@/lib/errors"
import crypto from "crypto"

export async function POST(req: Request) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        const rate = await applyRateLimit(req, "auth:verify-email-send")
        if (!rate.success) {
            return NextResponse.json(
                { message: "Too many requests. Please try again later." },
                { status: 429 }
            )
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id }
        })

        if (!user || !user.email) {
            return NextResponse.json(
                { message: "User not found or email not set" },
                { status: 404 }
            )
        }

        if (user.emailVerified) {
            return NextResponse.json({
                message: "Email is already verified"
            })
        }

        // Generate verification token
        const verificationToken = crypto.randomBytes(32).toString("hex")
        const expiresAt = new Date()
        expiresAt.setHours(expiresAt.getHours() + 24) // Token expires in 24 hours

        // Store token
        await prisma.verificationToken.upsert({
            where: {
                identifier_token: {
                    identifier: user.email,
                    token: verificationToken
                }
            },
            update: {
                token: verificationToken,
                expires: expiresAt
            },
            create: {
                identifier: user.email,
                token: verificationToken,
                expires: expiresAt
            }
        })

        // Send verification email
        const verifyUrl = `${process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/verify-email?token=${verificationToken}&email=${encodeURIComponent(user.email)}`
        
        const emailHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verify Your Email - JUNOHUB</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0e1a;">
    <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
            <td style="padding: 40px 20px; text-align: center;">
                <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #1e293b; border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.1); overflow: hidden;">
                    <tr>
                        <td style="padding: 40px;">
                            <h2 style="margin: 0 0 16px; font-size: 24px; font-weight: 700; color: #ffffff;">Verify Your Email</h2>
                            <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #cbd5e1;">
                                Please verify your email address to complete your account setup.
                            </p>
                            <a href="${verifyUrl}" style="display: inline-block; padding: 14px 32px; background-color: #4f46e5; color: #ffffff; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 16px;">
                                Verify Email
                            </a>
                            <p style="margin: 24px 0 0; font-size: 14px; color: #94a3b8;">
                                This link will expire in 24 hours.
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
            to: user.email,
            subject: "Verify Your JUNOHUB Email",
            html: emailHtml
        })

        return NextResponse.json({
            message: "Verification email sent successfully"
        })
    } catch (error) {
        return handleApiError(error, "verify-email-send")
    }
}
