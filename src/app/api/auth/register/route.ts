import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { applyRateLimit } from "@/lib/rate-limit"
import { authRegisterSchema } from "@/lib/validation"

export async function POST(req: Request) {
    try {
        const body = await req.json()

        // Basic rate limiting per IP for registrations
        const rate = await applyRateLimit(req, "auth:register")
        if (!rate.success) {
            return NextResponse.json(
                { message: "Too many signup attempts. Please try again later." },
                { status: 429 }
            )
        }

        const parseResult = authRegisterSchema.safeParse(body)

        if (!parseResult.success) {
            const message = parseResult.error.issues[0]?.message || "Invalid registration data."
            return NextResponse.json({ message }, { status: 400 })
        }

        const { name, email, password, role } = parseResult.data

        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
            where: { email }
        })

        if (existingUser) {
            return NextResponse.json({ message: "User already exists with this email." }, { status: 400 })
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10)

        // Create user
        const user = await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                role: role || "VENDOR"
            }
        })

        return NextResponse.json({
            message: "User registered successfully!",
            user: { id: user.id, name: user.name, email: user.email }
        })

    } catch (error) {
        console.error("Registration error:", error)
        return NextResponse.json({ message: "Internal server error during registration." }, { status: 500 })
    }
}
