import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

/**
 * GET /api/vendors/synced-products/[id]
 * Get a single product visible on the vendor's New Products page.
 * The ID may correspond to either:
 * - A ProductSync (vendor-initiated sync), or
 * - A SupplierProductOffer (supplier-provided product)
 */
export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()

        if (!session?.user?.id || session.user.role !== "VENDOR") {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        const { id } = await params

        // Get vendor's active store
        const vendorStore = await prisma.store.findFirst({
            where: {
                userId: session.user.id,
                isActive: true
            }
        })

        if (!vendorStore) {
            return NextResponse.json({ message: "Not found" }, { status: 404 })
        }

        // First, try to find a ProductSync
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sync = await (prisma as any).productSync.findFirst({
            where: {
                id,
                storeId: vendorStore.id
            },
            include: {
                supplier: {
                    select: {
                        id: true,
                        companyName: true
                    }
                }
            }
        })

        if (sync) {
            const productData = sync.shopifyProductData || {}
            const product = {
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
                isSynced: true,
                source: "synced",
                shopifyData: productData
            }

            return NextResponse.json({ product })
        }

        // Otherwise, try SupplierProductOffer
        if (!("supplierProductOffer" in prisma)) {
            return NextResponse.json({ message: "Product not found" }, { status: 404 })
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const offer = await (prisma as any).supplierProductOffer.findFirst({
            where: {
                id,
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
            }
        })

        if (!offer) {
            return NextResponse.json({ message: "Product not found" }, { status: 404 })
        }

        const product = {
            id: offer.id,
            syncId: null,
            shopifyProductId: null,
            title: offer.product.title,
            description: offer.product.description,
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
        }

        return NextResponse.json({ product })
    } catch (error) {
        console.error("Error fetching synced product:", error)
        return NextResponse.json(
            { message: "Failed to fetch product" },
            { status: 500 }
        )
    }
}

