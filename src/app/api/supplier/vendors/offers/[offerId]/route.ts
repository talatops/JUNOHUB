import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

/**
 * PUT /api/supplier/vendors/offers/[offerId]
 * Update an existing supplier product offer (price, quantity)
 */
export async function PUT(
    req: Request,
    { params }: { params: Promise<{ offerId: string }> }
) {
    try {
        const session = await auth()

        if (!session?.user?.id || session.user.role !== "SUPPLIER") {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        const { offerId } = await params
        const body = await req.json()
        const { price, quantity } = body as {
            price?: number
            quantity?: number
        }

        if (price === undefined && quantity === undefined) {
            return NextResponse.json(
                { message: "At least one of price or quantity must be provided" },
                { status: 400 }
            )
        }

        if (quantity !== undefined && quantity <= 0) {
            return NextResponse.json(
                { message: "Quantity must be greater than zero" },
                { status: 400 }
            )
        }

        if (price !== undefined && price < 0) {
            return NextResponse.json(
                { message: "Price must be non-negative" },
                { status: 400 }
            )
        }

        const supplierProfile = await prisma.supplierProfile.findUnique({
            where: { userId: session.user.id }
        })

        if (!supplierProfile) {
            return NextResponse.json({ message: "Supplier profile not found" }, { status: 404 })
        }

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
                id: offerId,
                supplierId: supplierProfile.id
            }
        })

        if (!existingOffer) {
            return NextResponse.json({ message: "Offer not found" }, { status: 404 })
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updatedOffer = await (prisma as any).supplierProductOffer.update({
            where: { id: offerId },
            data: {
                ...(price !== undefined ? { price } : {}),
                ...(quantity !== undefined ? { quantity } : {})
            }
        })

        return NextResponse.json({
            message: "Offer updated successfully",
            offer: updatedOffer
        })
    } catch (error) {
        console.error("Error updating supplier product offer:", error)
        return NextResponse.json(
            { message: "Failed to update supplier product offer" },
            { status: 500 }
        )
    }
}

/**
 * DELETE /api/supplier/vendors/offers/[offerId]
 * Withdraw an existing supplier product offer from a vendor
 */
export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ offerId: string }> }
) {
    try {
        const session = await auth()

        if (!session?.user?.id || session.user.role !== "SUPPLIER") {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        const { offerId } = await params

        const supplierProfile = await prisma.supplierProfile.findUnique({
            where: { userId: session.user.id }
        })

        if (!supplierProfile) {
            return NextResponse.json({ message: "Supplier profile not found" }, { status: 404 })
        }

        // Verify the offer belongs to this supplier
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
                id: offerId,
                supplierId: supplierProfile.id
            }
        })

        if (!existingOffer) {
            return NextResponse.json({ message: "Offer not found" }, { status: 404 })
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (prisma as any).supplierProductOffer.delete({
            where: { id: offerId }
        })

        return NextResponse.json({
            message: "Offer withdrawn successfully"
        })
    } catch (error) {
        console.error("Error deleting supplier product offer:", error)
        return NextResponse.json(
            { message: "Failed to withdraw supplier product offer" },
            { status: 500 }
        )
    }
}

