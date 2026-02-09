import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

/**
 * GET /api/supplier/product-syncs
 * Get all product sync requests for the authenticated supplier
 */
export async function GET(req: Request) {
    try {
        const session = await auth()

        if (!session?.user?.id || session.user.role !== "SUPPLIER") {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        const { searchParams } = new URL(req.url)
        const status = searchParams.get("status") // "PENDING", "ACCEPTED", "REJECTED", or null for all

        // Get supplier profile
        const supplierProfile = await prisma.supplierProfile.findUnique({
            where: { userId: session.user.id }
        })

        if (!supplierProfile) {
            return NextResponse.json({ syncs: [] })
        }

        // Build where clause
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: any = {
            supplierId: supplierProfile.id
        }

        if (status && ["PENDING", "ACCEPTED", "REJECTED"].includes(status)) {
            where.status = status
        }

        // Get product syncs
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const syncs = await (prisma as any).productSync.findMany({
            where,
            include: {
                store: {
                    select: {
                        id: true,
                        businessName: true,
                        shopifyDomain: true,
                        user: {
                            select: {
                                name: true,
                                email: true
                            }
                        }
                    }
                }
            },
            orderBy: {
                createdAt: "desc"
            }
        })

        return NextResponse.json({ syncs })
    } catch (error) {
        console.error("Error fetching product syncs:", error)
        return NextResponse.json(
            { message: "Failed to fetch product syncs" },
            { status: 500 }
        )
    }
}
