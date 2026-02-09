import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function GET() {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        if (session.user.role !== "VENDOR") {
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
