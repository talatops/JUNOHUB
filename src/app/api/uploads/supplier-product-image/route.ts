import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import fs from "fs/promises"
import path from "path"
import { randomUUID } from "crypto"
import { uploadSupplierProductImage } from "@/lib/s3"

// Store supplier product images.
// In production (S3 configured) we use S3.
// In local/dev (no S3) we fall back to writing under public so they can be served directly.
const LOCAL_UPLOAD_DIR =
    process.env.SUPPLIER_PRODUCT_IMAGES_DIR || "public/uploads/supplier-products"

async function ensureUploadDirForSupplier(supplierId: string) {
    const baseDir = path.resolve(LOCAL_UPLOAD_DIR)
    const supplierDir = path.join(baseDir, supplierId)
    await fs.mkdir(supplierDir, { recursive: true })
    return supplierDir
}

function buildPublicUrl(absoluteFilePath: string) {
    const publicRoot = path.resolve("public")
    const normalized = absoluteFilePath.replace(/\\/g, "/")
    const normalizedPublicRoot = publicRoot.replace(/\\/g, "/")

    if (normalized.startsWith(normalizedPublicRoot)) {
        const relative = normalized.slice(normalizedPublicRoot.length)
        return relative.startsWith("/") ? relative : `/${relative}`
    }

    // Fallback: if not under public, expose from root path based on configured dir
    const baseDir = path.resolve(LOCAL_UPLOAD_DIR).replace(/\\/g, "/")
    const relative = normalized.replace(baseDir, "").replace(/^\/?/, "/")
    return relative
}

async function uploadLocally(params: {
    supplierId: string
    buffer: Buffer
    fileName: string
    contentType?: string
}) {
    const extFromName = params.fileName.includes(".")
        ? params.fileName.split(".").pop()
        : undefined
    const ext = extFromName || "bin"

    const supplierDir = await ensureUploadDirForSupplier(params.supplierId)
    const fileNameOnDisk = `${randomUUID()}.${ext}`
    const storagePath = path.join(supplierDir, fileNameOnDisk)

    await fs.writeFile(storagePath, params.buffer)

    const url = buildPublicUrl(storagePath)
    return { url }
}

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

        const originalName = file.name || "image"

        // Try S3 first (for deployed environments). If S3 is not configured, fall back to local.
        try {
            const { url } = await uploadSupplierProductImage({
                supplierId: supplierProfile.id,
                fileBuffer: buffer,
                contentType: file.type || undefined,
                originalName
            })

            return NextResponse.json({ url })
        } catch (s3Error) {
            console.warn(
                "[SUPPLIER_PRODUCT_IMAGE_UPLOAD] S3 upload failed or not configured. Falling back to local storage.",
                s3Error
            )

            const { url } = await uploadLocally({
                supplierId: supplierProfile.id,
                buffer,
                fileName: originalName,
                contentType: file.type || undefined
            })

            return NextResponse.json({ url })
        }
    } catch (error) {
        console.error("[SUPPLIER_PRODUCT_IMAGE_UPLOAD]", error)
        return NextResponse.json(
            { message: "Failed to upload image" },
            { status: 500 }
        )
    }
}

