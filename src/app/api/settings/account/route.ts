import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { accountUpdateSchema } from "@/lib/validation"

export async function PUT(req: Request) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        const body = await req.json()
        const parseResult = accountUpdateSchema.safeParse(body)

        if (!parseResult.success) {
            const firstIssue = parseResult.error.issues[0]
            const field = firstIssue?.path?.[0]
            const message = firstIssue?.message || "Invalid account data."
            return NextResponse.json(
                { message, field },
                { status: 400 }
            )
        }

        const { businessName, currentPassword, newPassword } = parseResult.data

        // Update business name in active store
        if (businessName) {
            const activeStore = await prisma.store.findFirst({
                where: { userId: session.user.id, isActive: true }
            })

            if (activeStore) {
                await prisma.store.update({
                    where: { id: activeStore.id },
                    data: { businessName }
                })
            } else {
                // If no active store, update user name
                await prisma.user.update({
                    where: { id: session.user.id },
                    data: { name: businessName }
                })
            }
        }

        // Update password if provided
        if (newPassword && currentPassword) {
            const user = await prisma.user.findUnique({
                where: { id: session.user.id }
            })

            if (!user || !user.password) {
                return NextResponse.json(
                    { message: "Password change not available for this account" },
                    { status: 400 }
                )
            }

            const isValid = await bcrypt.compare(currentPassword, user.password)
            if (!isValid) {
                return NextResponse.json(
                    { message: "Current password is incorrect" },
                    { status: 400 }
                )
            }

            const hashedPassword = await bcrypt.hash(newPassword, 10)
            await prisma.user.update({
                where: { id: session.user.id },
                data: { password: hashedPassword }
            })
        }

        return NextResponse.json({ message: "Account updated successfully" })
    } catch (error) {
        console.error("Account update error:", error)
        return NextResponse.json(
            { message: "Internal server error" },
            { status: 500 }
        )
    }
}
