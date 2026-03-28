import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function GET() {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        // Suppliers use a different portal; treat them as "onboarding N/A"
        if (session.user.role === "SUPPLIER") {
            return NextResponse.json({ complete: true })
        }

        const store = await prisma.store.findFirst({
            where: { userId: session.user.id },
        })

        return NextResponse.json({
            complete: !!store?.onboardingComplete
        })
    } catch {
        return NextResponse.json({ message: "Internal server error" }, { status: 500 })
    }
}
