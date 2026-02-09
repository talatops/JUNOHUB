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
        const status = searchParams.get("status")

        const connections = await prisma.connection.findMany({
            where: {
                ...(status && { status: status as any }),
            },
            include: {
                store: true,
                supplier: true,
            },
            orderBy: {
                createdAt: "desc",
            },
        })

        return NextResponse.json({ connections })
    } catch (error) {
        console.error("Error fetching admin connections:", error)
        return NextResponse.json(
            { message: "Failed to fetch connections" },
            { status: 500 },
        )
    }
}

