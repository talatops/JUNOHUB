import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { uploadSupplierProductImage } from "@/lib/s3"

export async function POST(req: Request) {
    try {
        const session = await auth()
        if (!session?.user?.id || session.user.role !== "SUPPLIER") {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        const formData = await req.formData()
        const file = formData.get("file")

        if (!(file instanceof File)) {
            return NextResponse.json(
                { message: "Missing file" },
                { status: 400 }
            )
        }

        // Resolve supplier profile so we can scope keys per-supplier
        const supplierProfile = await prisma.supplierProfile.findUnique({
            where: { userId: session.user.id },
            select: { id: true }
        })

        if (!supplierProfile) {
            return NextResponse.json(
                { message: "Supplier profile not found" },
                { status: 404 }
            )
        }

        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        const { url } = await uploadSupplierProductImage({
            supplierId: supplierProfile.id,
            fileBuffer: buffer,
            contentType: file.type || undefined,
            originalName: file.name
        })

        return NextResponse.json({ url })
    } catch (error) {
        console.error("[SUPPLIER_PRODUCT_IMAGE_UPLOAD]", error)
        return NextResponse.json(
            { message: "Failed to upload image" },
            { status: 500 }
        )
    }
}

