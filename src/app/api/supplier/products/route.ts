import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { supplierQuantityFromSyncedProductData } from "@/lib/products/shopifyInventorySum"
import { supplierProductCreateSchema } from "@/lib/api-schemas/business"
import { validationErrorResponse } from "@/lib/api-schemas/validate"

/**
 * GET /api/supplier/products
 * List all products for the authenticated supplier
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

        // Get supplier's own products
        const ownProducts = await prisma.product.findMany({
            where: {
                supplierId: supplierProfile.id
            },
            orderBy: {
                createdAt: "desc"
            }
        })

        // Get synced products from vendors (products that vendors synced with this supplier)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const syncedProducts = await (prisma as any).productSync.findMany({
            where: {
                supplierId: supplierProfile.id,
                status: "ACCEPTED"
            },
            include: {
                store: {
                    select: {
                        id: true,
                        businessName: true
                    }
                }
            },
            orderBy: {
                acceptedAt: "desc"
            }
        })

        // Transform synced products to match product format
        const syncedProductsFormatted = syncedProducts.map((sync: any) => {
            const productData = sync.shopifyProductData || {}
            const supplierQuantity = supplierQuantityFromSyncedProductData(productData)

            return {
                id: `synced-${sync.id}`, // Unique ID for synced products
                syncId: sync.id,
                shopifyProductId: sync.shopifyProductId,
                title: sync.shopifyProductTitle,
                description: productData.body_html || productData.description || null,
                price: parseFloat(productData.variants?.[0]?.price || "0"),
                sku: productData.variants?.[0]?.sku || null,
                imageUrl: productData.image?.src || productData.images?.[0]?.src || null,
                createdAt: sync.createdAt,
                updatedAt: sync.updatedAt || sync.acceptedAt,
                vendor: {
                    id: sync.store.id,
                    businessName: sync.store.businessName
                },
                isSynced: true, // Flag to indicate this is a synced product from vendor
                availableQuantity: supplierQuantity ?? null,
                // Include full Shopify product data for reference
                shopifyData: productData
            }
        })

        // Combine own products and synced products
        const allProducts = [...ownProducts, ...syncedProductsFormatted]

        return NextResponse.json({ products: allProducts })
    } catch (error) {
        console.error("Error fetching products:", error)
        return NextResponse.json(
            { message: "Failed to fetch products" },
            { status: 500 }
        )
    }
}

/**
 * POST /api/supplier/products
 * Create a new product
 */
export async function POST(req: Request) {
    try {
        const session = await auth()

        if (!session?.user?.id || session.user.role !== "SUPPLIER") {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        const raw = await req.json().catch(() => ({}))
        const parsed = supplierProductCreateSchema.safeParse(raw)
        if (!parsed.success) {
            return validationErrorResponse(parsed.error)
        }
        const { title, description, price, sku, imageUrl } = parsed.data

        // Get supplier profile
        const supplierProfile = await prisma.supplierProfile.findUnique({
            where: { userId: session.user.id }
        })

        if (!supplierProfile) {
            return NextResponse.json({ message: "Supplier profile not found" }, { status: 404 })
        }

        const product = await prisma.product.create({
            data: {
                supplierId: supplierProfile.id,
                title,
                description: description?.trim() ? description : null,
                price,
                sku: sku?.trim() ? sku : null,
                imageUrl: imageUrl?.trim() ? imageUrl : null,
            }
        })

        return NextResponse.json({
            message: "Product created successfully",
            product
        })
    } catch (error) {
        console.error("Error creating product:", error)
        return NextResponse.json(
            { message: "Failed to create product" },
            { status: 500 }
        )
    }
}
