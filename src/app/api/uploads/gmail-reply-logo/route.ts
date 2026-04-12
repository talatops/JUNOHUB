import { NextResponse } from "next/server"
import { auth } from "@/auth.vendor"
import { prisma } from "@/lib/prisma"
import fs from "fs/promises"
import path from "path"
import { randomUUID } from "crypto"

const LOCAL_DIR = process.env.GMAIL_REPLY_LOGOS_DIR || "public/uploads/gmail-reply-logos"

export async function POST(req: Request) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        const formData = await req.formData()
        const file = formData.get("file")
        const storeIdRaw = formData.get("storeId")
        if (!(file instanceof File)) {
            return NextResponse.json({ message: "Missing file" }, { status: 400 })
        }
        if (typeof storeIdRaw !== "string" || !storeIdRaw.trim()) {
            return NextResponse.json({ message: "Missing storeId" }, { status: 400 })
        }
        const storeId = storeIdRaw.trim()

        const store = await prisma.store.findFirst({
            where: { id: storeId, userId: session.user.id },
            select: { id: true },
        })
        if (!store) {
            return NextResponse.json({ message: "Store not found" }, { status: 404 })
        }

        if (!file.type.startsWith("image/")) {
            return NextResponse.json({ message: "Only image files are allowed" }, { status: 400 })
        }

        const maxBytes = 2 * 1024 * 1024
        if (file.size > maxBytes) {
            return NextResponse.json({ message: "Image too large (max 2MB)" }, { status: 400 })
        }

        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        const originalName = file.name || "logo"
        const extFromName = originalName.includes(".") ? originalName.split(".").pop() : undefined
        const ext = extFromName || "png"

        const baseDir = path.resolve(LOCAL_DIR)
        const storeDir = path.join(baseDir, storeId)
        await fs.mkdir(storeDir, { recursive: true })
        const fileNameOnDisk = `${randomUUID()}.${ext}`
        const storagePath = path.join(storeDir, fileNameOnDisk)

        await fs.writeFile(storagePath, buffer)

        const publicUrl = `/uploads/gmail-reply-logos/${storeId}/${fileNameOnDisk}`
        return NextResponse.json({ url: publicUrl })
    } catch (error) {
        console.error("[GMAIL_REPLY_LOGO_UPLOAD]", error)
        return NextResponse.json({ message: "Failed to upload logo image" }, { status: 500 })
    }
}
