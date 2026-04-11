import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { supplierProductUpdateSchema } from "@/lib/api-schemas/business"
import { validationErrorResponse } from "@/lib/api-schemas/validate"

/**
 * PUT /api/supplier/products/[productId]
 * Update a product
 */
export async function PUT(
    req: Request,
    { params }: { params: Promise<{ productId: string }> }
) {
    try {
        const session = await auth()

        if (!session?.user?.id || session.user.role !== "SUPPLIER") {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        const { productId } = await params
        const raw = await req.json().catch(() => ({}))
        const parsed = supplierProductUpdateSchema.safeParse(raw)
        if (!parsed.success) {
            return validationErrorResponse(parsed.error)
        }
        const { title, description, price, sku, imageUrl, quantity } = parsed.data

        // Get supplier profile
        const supplierProfile = await prisma.supplierProfile.findUnique({
            where: { userId: session.user.id }
        })

        if (!supplierProfile) {
            return NextResponse.json({ message: "Supplier profile not found" }, { status: 404 })
        }

        // Check if this is a synced product (starts with "synced-")
        if (productId.startsWith("synced-")) {
            const syncId = productId.replace("synced-", "")
            
            // Update synced product data in ProductSync
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const productSync = await (prisma as any).productSync.findUnique({
                where: { id: syncId },
                include: {
                    supplier: {
                        select: { id: true }
                    },
                    store: {
                        select: {
                            id: true,
                            businessName: true,
                            userId: true
                        }
                    }
                }
            })

            if (!productSync || productSync.supplierId !== supplierProfile.id) {
                return NextResponse.json({ message: "Synced product not found" }, { status: 404 })
            }

            // Update the shopifyProductData with new values (including optional supplier-specific quantity)
            const updatedData = {
                ...(productSync.shopifyProductData || {}),
                title: title ?? productSync.shopifyProductTitle,
                body_html:
                    description !== undefined
                        ? description
                        : productSync.shopifyProductData?.body_html || "",
                variants:
                    productSync.shopifyProductData?.variants?.map((v: any, idx: number) => ({
                        ...v,
                        price: idx === 0 && price !== undefined ? String(price) : v.price,
                        sku: idx === 0 && sku !== undefined ? sku : v.sku,
                    })) || [],
                image:
                    imageUrl != null && String(imageUrl).trim() !== ""
                        ? { src: String(imageUrl).trim() }
                        : productSync.shopifyProductData?.image,
                supplier_quantity:
                    quantity !== undefined
                        ? quantity
                        : productSync.shopifyProductData?.supplier_quantity,
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const updatedSync = await (prisma as any).productSync.update({
                where: { id: syncId },
                data: {
                    shopifyProductTitle: title ?? productSync.shopifyProductTitle,
                    shopifyProductData: updatedData,
                }
            })

            // Notify the vendor that the supplier updated this synced product
            try {
                if (productSync.store?.userId) {
                    const { createNotification } = await import("@/lib/notifications")
                    await createNotification({
                        userId: productSync.store.userId,
                        type: "PRODUCT_UPDATED",
                        title: "Supplier updated product",
                        message: `${supplierProfile.companyName} updated the price or amount for "${title || productSync.shopifyProductTitle}".`,
                        metadata: {
                            syncId,
                            storeId: productSync.store.id,
                            supplierId: supplierProfile.id
                        },
                        url: "/dashboard/new-products"
                    })
                }
            } catch (notifError) {
                console.error("Error creating notification for synced product update:", notifError)
            }

            return NextResponse.json({
                message: "Synced product updated successfully",
                product: {
                    id: productId,
                    syncId,
                    title: title ?? productSync.shopifyProductTitle,
                    description,
                    price:
                        price !== undefined
                            ? price
                            : parseFloat(updatedData.variants?.[0]?.price || "0"),
                    sku,
                    imageUrl,
                    availableQuantity: updatedData.supplier_quantity,
                    isSynced: true
                }
            })
        }

        // Regular product update
        const existingProduct = await prisma.product.findFirst({
            where: {
                id: productId,
                supplierId: supplierProfile.id
            }
        })

        if (!existingProduct) {
            return NextResponse.json({ message: "Product not found" }, { status: 404 })
        }

        const product = await prisma.product.update({
            where: { id: productId },
            data: {
                title: title ?? existingProduct.title,
                description: description !== undefined ? description : existingProduct.description,
                price: price !== undefined ? price : existingProduct.price,
                sku: sku !== undefined ? sku : existingProduct.sku,
                imageUrl: imageUrl !== undefined ? imageUrl : existingProduct.imageUrl,
            }
        })

        return NextResponse.json({
            message: "Product updated successfully",
            product
        })
    } catch (error) {
        console.error("Error updating product:", error)
        return NextResponse.json(
            { message: "Failed to update product" },
            { status: 500 }
        )
    }
}

/**
 * DELETE /api/supplier/products/[productId]
 * Delete a product
 */
export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ productId: string }> }
) {
    try {
        const session = await auth()

        if (!session?.user?.id || session.user.role !== "SUPPLIER") {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        const { productId } = await params

        // Get supplier profile
        const supplierProfile = await prisma.supplierProfile.findUnique({
            where: { userId: session.user.id }
        })

        if (!supplierProfile) {
            return NextResponse.json({ message: "Supplier profile not found" }, { status: 404 })
        }

        // Check if this is a synced product - synced products cannot be deleted
        if (productId.startsWith("synced-")) {
            return NextResponse.json(
                { message: "Synced products from vendors cannot be deleted. You can only edit them." },
                { status: 400 }
            )
        }

        // Verify product belongs to supplier
        const existingProduct = await prisma.product.findFirst({
            where: {
                id: productId,
                supplierId: supplierProfile.id
            }
        })

        if (!existingProduct) {
            return NextResponse.json({ message: "Product not found" }, { status: 404 })
        }

        await prisma.product.delete({
            where: { id: productId }
        })

        return NextResponse.json({
            message: "Product deleted successfully"
        })
    } catch (error) {
        console.error("Error deleting product:", error)
        return NextResponse.json(
            { message: "Failed to delete product" },
            { status: 500 }
        )
    }
}
