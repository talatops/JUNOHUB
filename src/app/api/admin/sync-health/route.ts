import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
    try {
        const session = await auth()

        if (!session?.user?.id || session.user.role !== "ADMIN") {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        const syncs = await prisma.syncMetadata.findMany({
            include: {
                store: true,
            },
            orderBy: {
                lastSyncAt: "desc",
            },
        })

        return NextResponse.json({ syncs })
    } catch (error) {
        console.error("Error fetching admin sync health:", error)
        return NextResponse.json(
            { message: "Failed to fetch sync health" },
            { status: 500 },
        )
    }
}

