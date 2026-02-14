import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { ProductSyncStatus } from "@prisma/client"

const VALID_STATUSES: ProductSyncStatus[] = [
    ProductSyncStatus.PENDING,
    ProductSyncStatus.ACCEPTED,
    ProductSyncStatus.REJECTED,
]

export async function GET(req: Request) {
    try {
        const session = await auth()

        if (!session?.user?.id || session.user.role !== "ADMIN") {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        const { searchParams } = new URL(req.url)
        const statusParam = searchParams.get("status")
        const status =
            statusParam && VALID_STATUSES.includes(statusParam as ProductSyncStatus)
                ? (statusParam as ProductSyncStatus)
                : undefined

        const syncs = await prisma.productSync.findMany({
            where: {
                ...(status && { status }),
            },
            include: {
                store: true,
                supplier: true,
            },
            orderBy: {
                createdAt: "desc",
            },
        })

        return NextResponse.json({ syncs })
    } catch (error) {
        console.error("Error fetching admin product syncs:", error)
        return NextResponse.json(
            { message: "Failed to fetch product syncs" },
            { status: 500 },
        )
    }
}

