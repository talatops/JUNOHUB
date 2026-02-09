import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: Request) {
    try {
        const session = await auth()

        if (!session?.user?.id || session.user.role !== "ADMIN") {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        const { searchParams } = new URL(req.url)
        const limit = parseInt(searchParams.get("limit") || "50", 10)
        const storeId = searchParams.get("storeId")
        const status = searchParams.get("status")
        const trigger = searchParams.get("trigger")

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const logs = await (prisma as any).emailLog.findMany({
            where: {
                ...(storeId && { storeId }),
                ...(status && { status }),
                ...(trigger && { trigger }),
            },
            include: {
                store: true,
            },
            orderBy: {
                sentAt: "desc",
            },
            take: limit,
        })

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const total = await (prisma as any).emailLog.count()

        return NextResponse.json({ emails: logs, total })
    } catch (error) {
        console.error("Error fetching admin email logs:", error)
        return NextResponse.json(
            { message: "Failed to fetch email logs" },
            { status: 500 },
        )
    }
}

