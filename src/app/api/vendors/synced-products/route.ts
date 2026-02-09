import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

/**
 * GET /api/vendors/synced-products
 * Get all synced products for the vendor (read-only)
 * These are products that vendors have synced with suppliers
 */
export async function GET() {
    try {
        const session = await auth()

        if (!session?.user?.id || session.user.role !== "VENDOR") {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        // Get vendor's active store
        const vendorStore = await prisma.store.findFirst({
            where: {
                userId: session.user.id,
                isActive: true
            }
        })

        if (!vendorStore) {
            return NextResponse.json({ products: [] })
        }

        // Get all ACCEPTED product syncs for this store
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const acceptedSyncs = await (prisma as any).productSync.findMany({
            where: {
                storeId: vendorStore.id,
                status: "ACCEPTED"
            },
            include: {
                supplier: {
                    select: {
                        id: true,
                        companyName: true
                    }
                }
            },
            orderBy: {
                acceptedAt: "desc"
            }
        })

        // Transform syncs into product-like objects for display
        const syncedProducts = acceptedSyncs.map((sync: any) => {
            const productData = sync.shopifyProductData || {}
            return {
                id: sync.id,
                syncId: sync.id,
                shopifyProductId: sync.shopifyProductId,
                title: sync.shopifyProductTitle,
                description: productData.body_html || productData.description || null,
                price: productData.variants?.[0]?.price || "0",
                sku: productData.variants?.[0]?.sku || null,
                imageUrl: productData.image?.src || productData.images?.[0]?.src || null,
                supplier: {
                    id: sync.supplier.id,
                    companyName: sync.supplier.companyName
                },
                syncedAt: sync.acceptedAt || sync.createdAt,
                isSynced: true, // Flag to indicate this is a synced product
                // Include full Shopify product data for reference
                shopifyData: productData
            }
        })

        return NextResponse.json({ products: syncedProducts })
    } catch (error) {
        console.error("Error fetching synced products:", error)
        return NextResponse.json(
            { message: "Failed to fetch synced products" },
            { status: 500 }
        )
    }
}
