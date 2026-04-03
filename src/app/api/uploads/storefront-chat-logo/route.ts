import { NextResponse } from "next/server"
import { auth } from "@/auth"
import fs from "fs/promises"
import path from "path"
import { randomUUID } from "crypto"
import { uploadStorefrontChatLogo } from "@/lib/s3"

const LOCAL_UPLOAD_DIR =
    process.env.STOREFRONT_CHAT_LOGOS_DIR || "public/uploads/storefront-chat-logos"

async function ensureUploadDirForVendor(vendorId: string) {
    const baseDir = path.resolve(LOCAL_UPLOAD_DIR)
    const vendorDir = path.join(baseDir, vendorId)
    await fs.mkdir(vendorDir, { recursive: true })
    return vendorDir
}

function buildPublicUrl(absoluteFilePath: string) {
    const publicRoot = path.resolve("public")
    const normalized = absoluteFilePath.replace(/\\/g, "/")
    const normalizedPublicRoot = publicRoot.replace(/\\/g, "/")

    if (normalized.startsWith(normalizedPublicRoot)) {
        const relative = normalized.slice(normalizedPublicRoot.length)
        return relative.startsWith("/") ? relative : `/${relative}`
    }

    const baseDir = path.resolve(LOCAL_UPLOAD_DIR).replace(/\\/g, "/")
    const relative = normalized.replace(baseDir, "").replace(/^\/?/, "/")
    return relative
}

async function uploadLocally(params: {
    vendorId: string
    buffer: Buffer
    fileName: string
}) {
    const extFromName = params.fileName.includes(".")
        ? params.fileName.split(".").pop()
        : undefined
    const ext = extFromName || "bin"

    const vendorDir = await ensureUploadDirForVendor(params.vendorId)
    const fileNameOnDisk = `${randomUUID()}.${ext}`
    const storagePath = path.join(vendorDir, fileNameOnDisk)

    await fs.writeFile(storagePath, params.buffer)
    const url = buildPublicUrl(storagePath)
    return { url }
}

export async function POST(req: Request) {
    try {
        const session = await auth()
        if (!session?.user?.id || session.user.role !== "VENDOR") {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        const formData = await req.formData()
        const file = formData.get("file")
        if (!(file instanceof File)) {
            return NextResponse.json({ message: "Missing file" }, { status: 400 })
        }

        if (!file.type.startsWith("image/")) {
            return NextResponse.json({ message: "Only image files are allowed" }, { status: 400 })
        }

        const maxBytes = 3 * 1024 * 1024
        if (file.size > maxBytes) {
            return NextResponse.json({ message: "Image too large (max 3MB)" }, { status: 400 })
        }

        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        const originalName = file.name || "logo"

        try {
            const { url } = await uploadStorefrontChatLogo({
                vendorId: session.user.id,
                fileBuffer: buffer,
                contentType: file.type || undefined,
                originalName,
            })
            return NextResponse.json({ url })
        } catch (s3Error) {
            console.warn(
                "[STOREFRONT_CHAT_LOGO_UPLOAD] S3 upload failed or not configured. Falling back to local storage.",
                s3Error
            )

            const { url } = await uploadLocally({
                vendorId: session.user.id,
                buffer,
                fileName: originalName,
            })
            return NextResponse.json({ url })
        }
    } catch (error) {
        console.error("[STOREFRONT_CHAT_LOGO_UPLOAD]", error)
        return NextResponse.json({ message: "Failed to upload logo image" }, { status: 500 })
    }
}
