import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { createNotification } from "@/lib/notifications"

/**
 * GET /api/supplier/vendors/[connectionId]/offers
 * List all products this supplier has offered to a specific vendor connection
 */
export async function GET(
    req: Request,
    { params }: { params: Promise<{ connectionId: string }> }
) {
    try {
        const session = await auth()

        if (!session?.user?.id || session.user.role !== "SUPPLIER") {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        const { connectionId } = await params

        const supplierProfile = await prisma.supplierProfile.findUnique({
            where: { userId: session.user.id }
        })

        if (!supplierProfile) {
            return NextResponse.json({ message: "Supplier profile not found" }, { status: 404 })
        }

        const connection = await prisma.connection.findFirst({
            where: {
                id: connectionId,
                supplierId: supplierProfile.id
            },
            include: {
                store: true
            }
        })

        if (!connection) {
            return NextResponse.json({ message: "Connection not found" }, { status: 404 })
        }

        // Access SupplierProductOffer model (camelCase in Prisma Client)
        if (!("supplierProductOffer" in prisma)) {
            console.error("Prisma Client missing supplierProductOffer model. Run: npx prisma generate")
            return NextResponse.json(
                { message: "Database model not available. Please regenerate Prisma Client." },
                { status: 500 }
            )
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const offers = await (prisma as any).supplierProductOffer.findMany({
            where: {
                connectionId: connection.id
            },
            include: {
                product: true,
                store: {
                    select: {
                        id: true,
                        businessName: true
                    }
                }
            },
            orderBy: {
                createdAt: "desc"
            }
        })

        return NextResponse.json({
            offers
        })
    } catch (error) {
        console.error("Error fetching supplier product offers:", error)
        return NextResponse.json(
            { message: "Failed to fetch supplier product offers" },
            { status: 500 }
        )
    }
}

/**
 * POST /api/supplier/vendors/[connectionId]/offers
 * Create a new product offer from supplier to this vendor
 */
export async function POST(
    req: Request,
    { params }: { params: Promise<{ connectionId: string }> }
) {
    try {
        const session = await auth()

        if (!session?.user?.id || session.user.role !== "SUPPLIER") {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        const { connectionId } = await params
        const body = await req.json()
        const { productId, price, quantity } = body as {
            productId?: string
            price?: number
            quantity?: number
        }

        if (!productId || price === undefined || quantity === undefined) {
            return NextResponse.json(
                { message: "productId, price and quantity are required" },
                { status: 400 }
            )
        }

        if (quantity <= 0 || price < 0) {
            return NextResponse.json(
                { message: "Price must be non-negative and quantity must be greater than zero" },
                { status: 400 }
            )
        }

        const supplierProfile = await prisma.supplierProfile.findUnique({
            where: { userId: session.user.id }
        })

        if (!supplierProfile) {
            return NextResponse.json({ message: "Supplier profile not found" }, { status: 404 })
        }

        const connection = await prisma.connection.findFirst({
            where: {
                id: connectionId,
                supplierId: supplierProfile.id
            },
            include: {
                store: {
                    select: {
                        id: true,
                        businessName: true,
                        user: {
                            select: {
                                id: true
                            }
                        }
                    }
                }
            }
        })

        if (!connection) {
            return NextResponse.json({ message: "Connection not found" }, { status: 404 })
        }

        if (connection.status !== "CONNECTED") {
            return NextResponse.json(
                { message: "You can only provide products to connected vendors" },
                { status: 400 }
            )
        }

        // Ensure the product belongs to this supplier
        const product = await prisma.product.findFirst({
            where: {
                id: productId,
                supplierId: supplierProfile.id
            }
        })

        if (!product) {
            return NextResponse.json(
                { message: "Product not found or does not belong to this supplier" },
                { status: 404 }
            )
        }

        // Check for existing offer for this product + store
        if (!("supplierProductOffer" in prisma)) {
            console.error("Prisma Client missing supplierProductOffer model. Run: npx prisma generate")
            return NextResponse.json(
                { message: "Database model not available. Please regenerate Prisma Client." },
                { status: 500 }
            )
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const existingOffer = await (prisma as any).supplierProductOffer.findFirst({
            where: {
                productId,
                storeId: connection.storeId
            }
        })

        if (existingOffer) {
            return NextResponse.json(
                { message: "This product has already been provided to this vendor" },
                { status: 400 }
            )
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const offer = await (prisma as any).supplierProductOffer.create({
            data: {
                productId,
                storeId: connection.storeId,
                connectionId: connection.id,
                supplierId: supplierProfile.id,
                price,
                quantity
            }
        })

        // Notify vendor that a new product is available in their New Products page
        try {
            if (connection.store?.user?.id) {
                await createNotification({
                    userId: connection.store.user.id,
                    type: "PRODUCT_UPDATED",
                    title: "New product from supplier",
                    message: `${supplierProfile.companyName} has provided a new product "${product.title}" for your store ${connection.store.businessName}.`,
                    metadata: {
                        offerId: offer.id,
                        productId: product.id,
                        supplierId: supplierProfile.id,
                        storeId: connection.store.id
                    },
                    url: "/dashboard/new-products"
                })
            }
        } catch (notifError) {
            console.error("Error creating notification for supplier product offer:", notifError)
        }

        return NextResponse.json({
            message: "Product provided to vendor successfully",
            offer
        })
    } catch (error) {
        console.error("Error creating supplier product offer:", error)
        return NextResponse.json(
            { message: "Failed to provide product to vendor" },
            { status: 500 }
        )
    }
}

