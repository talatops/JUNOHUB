import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

/**
 * GET /api/supplier/analytics
 * Get analytics data for supplier
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

        // Get counts
        const [productsCount, connectedVendorsCount, pendingConnectionsCount] = await Promise.all([
            prisma.product.count({
                where: { supplierId: supplierProfile.id }
            }),
            prisma.connection.count({
                where: {
                    supplierId: supplierProfile.id,
                    status: "CONNECTED"
                }
            }),
            prisma.connection.count({
                where: {
                    supplierId: supplierProfile.id,
                    status: "PENDING"
                }
            })
        ])

        // Calculate average product price
        const products = await prisma.product.findMany({
            where: { supplierId: supplierProfile.id },
            select: { price: true }
        })

        const averagePrice = products.length > 0
            ? products.reduce((sum: number, p: { price: number }) => sum + p.price, 0) / products.length
            : 0

        // Get recent activity (last 7 days)
        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

        const recentProducts = await prisma.product.count({
            where: {
                supplierId: supplierProfile.id,
                createdAt: { gte: sevenDaysAgo }
            }
        })

        const recentConnections = await prisma.connection.count({
            where: {
                supplierId: supplierProfile.id,
                createdAt: { gte: sevenDaysAgo }
            }
        })

        return NextResponse.json({
            stats: {
                totalProducts: productsCount,
                connectedVendors: connectedVendorsCount,
                pendingConnections: pendingConnectionsCount,
                averageProductPrice: averagePrice,
                recentProducts,
                recentConnections
            },
            // Placeholder for chart data - would be populated with actual order data
            chartData: []
        })
    } catch (error) {
        console.error("Error fetching analytics:", error)
        return NextResponse.json(
            { message: "Failed to fetch analytics" },
            { status: 500 }
        )
    }
}
