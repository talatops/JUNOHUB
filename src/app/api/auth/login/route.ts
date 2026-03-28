import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { decryptString } from "@/lib/encryption"
import { applyRateLimit } from "@/lib/rate-limit"
import { authLoginSchema } from "@/lib/validation"
import { logger } from "@/lib/logger"

const ADMIN_EMAIL = process.env.ADMIN_EMAIL
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD

export async function POST(req: Request) {
    try {
        // Basic rate limiting per IP for login attempts
        const rate = await applyRateLimit(req, "auth:login")
        if (!rate.success) {
            return NextResponse.json(
                { message: "Too many login attempts. Please try again later." },
                { status: 429 }
            )
        }

        const body = await req.json()
        const parseResult = authLoginSchema.safeParse(body)

        if (!parseResult.success) {
            const message = parseResult.error.issues[0]?.message || "Invalid login data."
            return NextResponse.json({ message }, { status: 400 })
        }

        const { email, password, mfaCode } = parseResult.data

        if (!email || !password || email.trim() === "" || password.trim() === "") {
            return NextResponse.json(
                { message: "Email and password are required" },
                { status: 400 },
            )
        }

        // Special-case env-configured admin user so it can log in even if not pre-seeded
        if (ADMIN_EMAIL && ADMIN_PASSWORD && email === ADMIN_EMAIL) {
            const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10)

            const adminUser = await prisma.user.upsert({
                where: { email: ADMIN_EMAIL },
                update: {
                    password: hashedPassword,
                    role: "ADMIN",
                },
                create: {
                    email: ADMIN_EMAIL,
                    password: hashedPassword,
                    role: "ADMIN",
                    name: "Admin",
                },
            })

            const isValidAdminPassword = await bcrypt.compare(password, adminUser.password!)
            if (!isValidAdminPassword) {
                return NextResponse.json(
                    { message: "Invalid email or password" },
                    { status: 401 },
                )
            }

            // Admin currently does not go through MFA in this flow
            return NextResponse.json({
                message: "Authentication successful",
                requiresMFA: false,
                verified: true,
            })
        }

        // Regular user login flow
        const userResult = await prisma.$queryRaw`
            SELECT id, password, "mfaEnabled", "mfaSecret" FROM "User" WHERE email = ${email}
        ` as Array<{
            id: string
            password: string | null
            mfaEnabled: boolean | null
            mfaSecret: string | null
        }>

        if (!userResult || userResult.length === 0) {
            return NextResponse.json(
                { message: "Invalid email or password" },
                { status: 401 },
            )
        }

        const user = userResult[0]

        if (!user.password) {
            return NextResponse.json(
                { message: "Invalid email or password" },
                { status: 401 },
            )
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password)
        if (!isValidPassword) {
            return NextResponse.json(
                { message: "Invalid email or password" },
                { status: 401 },
            )
        }

        // Check if MFA is enabled
        const mfaEnabled = user.mfaEnabled ?? false

        if (mfaEnabled) {
            // If MFA code is not provided, return that MFA is required
            if (!mfaCode) {
                return NextResponse.json(
                    { 
                        message: "MFA verification required",
                        requiresMFA: true 
                    },
                    { status: 200 }
                )
            }

            // Verify MFA code
                const mfaSecret = decryptString(user.mfaSecret)
            if (!mfaSecret) {
                return NextResponse.json(
                    { message: "MFA is enabled but no secret found. Please contact support." },
                    { status: 500 }
                )
            }

            const { verify } = await import("otplib")
            const verifyResult = await verify({ token: mfaCode, secret: mfaSecret })
            const isValidMFA = verifyResult.valid ?? false

            if (!isValidMFA) {
                return NextResponse.json(
                    { message: "Invalid verification code" },
                    { status: 401 }
                )
            }
        }

        // If we get here, credentials and MFA (if enabled) are valid
        // Return success - the client will call NextAuth signIn
        return NextResponse.json({
            message: "Authentication successful",
            requiresMFA: false,
            verified: true
        })
    } catch (error) {
        logger.error("Login error", error)
        return NextResponse.json(
            { message: "Internal server error" },
            { status: 500 }
        )
    }
}
