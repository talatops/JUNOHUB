import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

/**
 * GET /api/supplier/vendors
 * List all vendor connections for the authenticated supplier
 */
export async function GET() {
    try {
        const session = await auth()

        if (!session?.user?.id || session.user.role !== "SUPPLIER") {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        // Get supplier profile
        const supplierProfile = await prisma.supplierProfile.findUnique({
            where: { userId: session.user.id }
        })

        if (!supplierProfile) {
            return NextResponse.json({ message: "Supplier profile not found" }, { status: 404 })
        }

        const connections = await prisma.connection.findMany({
            where: {
                supplierId: supplierProfile.id
            },
            include: {
                store: {
                    select: {
                        id: true,
                        businessName: true,
                        shopifyDomain: true,
                        shopifyStoreName: true,
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

        return NextResponse.json({ connections })
    } catch (error) {
        console.error("Error fetching vendor connections:", error)
        return NextResponse.json(
            { message: "Failed to fetch vendor connections" },
            { status: 500 }
        )
    }
}
