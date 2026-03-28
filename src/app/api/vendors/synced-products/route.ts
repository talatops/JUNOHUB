import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { isVendorPortalRole } from "@/lib/auth-roles"
import { prisma } from "@/lib/prisma"

/**
 * GET /api/vendors/synced-products
 * Get all products available to the vendor (read-only)
 * Includes:
 * - Products that vendors have synced with suppliers (ProductSync ACCEPTED)
 * - Products that suppliers have provided directly to this vendor (SupplierProductOffer)
 */
export async function GET() {
    try {
        const session = await auth()

        if (!session?.user?.id || !isVendorPortalRole(session.user.role)) {
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

        // Get all ACCEPTED product syncs for this store (vendor-initiated)
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
            const supplierQuantity =
                typeof productData.supplier_quantity === "number"
                    ? productData.supplier_quantity
                    : undefined
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
                source: "synced",
                offerQuantity: supplierQuantity,
                // Include full Shopify product data for reference
                shopifyData: productData
            }
        })

        // Get supplier-provided products for this store
        if (!("supplierProductOffer" in prisma)) {
            console.error("Prisma Client missing supplierProductOffer model. Run: npx prisma generate")
            // Return only synced products if SupplierProductOffer model is missing
            return NextResponse.json({ products: syncedProducts })
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const supplierOffers = await (prisma as any).supplierProductOffer.findMany({
            where: {
                storeId: vendorStore.id
            },
            include: {
                product: {
                    select: {
                        id: true,
                        title: true,
                        description: true,
                        price: true,
                        sku: true,
                        imageUrl: true
                    }
                },
                supplier: {
                    select: {
                        id: true,
                        companyName: true
                    }
                }
            },
            orderBy: {
                createdAt: "desc"
            }
        })

        const supplierProducts = supplierOffers.map((offer: any) => ({
            id: offer.id,
            syncId: null,
            shopifyProductId: null,
            title: offer.product.title,
            description: offer.product.description,
            // Store as string for consistency with existing response
            price: offer.price.toFixed(2),
            sku: offer.product.sku,
            imageUrl: offer.product.imageUrl,
            supplier: {
                id: offer.supplier.id,
                companyName: offer.supplier.companyName
            },
            syncedAt: offer.createdAt,
            isSynced: false,
            source: "supplier_offer",
            offerQuantity: offer.quantity,
            offerId: offer.id
        }))

        const allProducts = [...syncedProducts, ...supplierProducts]

        return NextResponse.json({ products: allProducts })
    } catch (error) {
        console.error("Error fetching synced products:", error)
        return NextResponse.json(
            { message: "Failed to fetch synced products" },
            { status: 500 }
        )
    }
}
