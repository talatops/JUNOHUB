import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

type AdminEventType = "CONNECTION" | "PRODUCT_SYNC" | "SYNC_HEALTH"

export async function GET(req: Request) {
    try {
        const session = await auth()

        if (!session?.user?.id || session.user.role !== "ADMIN") {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        const { searchParams } = new URL(req.url)
        const limit = parseInt(searchParams.get("limit") || "50", 10)
        const typeFilter = searchParams.get("type") as AdminEventType | null

        const [connectionEvents, productSyncEvents, syncHealthEvents] = await Promise.all([
            prisma.connection.findMany({
                orderBy: { createdAt: "desc" },
                take: limit,
                include: {
                    store: true,
                    supplier: true,
                },
            }),
            (prisma as any).productSync.findMany({
                orderBy: { createdAt: "desc" },
                take: limit,
                include: {
                    store: true,
                    supplier: true,
                },
            }),
            prisma.syncMetadata.findMany({
                orderBy: { lastSyncAt: "desc" },
                take: limit,
                include: {
                    store: true,
                },
            }),
        ])

        const events = [
            ...connectionEvents.map((c: typeof connectionEvents[0]) => ({
                id: c.id,
                type: "CONNECTION" as AdminEventType,
                status: c.status,
                timestamp: c.createdAt,
                storeName: c.store.shopifyStoreName,
                supplierName: c.supplier.companyName,
                metadata: {},
            })),
            ...productSyncEvents.map((p: any) => ({
                id: p.id,
                type: "PRODUCT_SYNC" as AdminEventType,
                status: p.status,
                timestamp: p.createdAt,
                storeName: p.store.shopifyStoreName,
                supplierName: p.supplier.companyName,
                metadata: {
                    productTitle: p.shopifyProductTitle,
                    shopifyProductId: p.shopifyProductId,
                },
            })),
            ...syncHealthEvents.map((s: typeof syncHealthEvents[0]) => ({
                id: s.id,
                type: "SYNC_HEALTH" as AdminEventType,
                status: s.syncStatus,
                timestamp: s.lastSyncAt,
                storeName: s.store.shopifyStoreName,
                supplierName: null,
                metadata: {
                    resourceType: s.resourceType,
                    recordCount: s.recordCount,
                },
            })),
        ]
            .filter((event) => !typeFilter || event.type === typeFilter)
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
            .slice(0, limit)

        return NextResponse.json({ events })
    } catch (error) {
        console.error("Error fetching admin events:", error)
        return NextResponse.json(
            { message: "Failed to fetch events" },
            { status: 500 },
        )
    }
}

