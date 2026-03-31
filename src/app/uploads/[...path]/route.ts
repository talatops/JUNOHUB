import { NextResponse } from "next/server"
import fs from "node:fs/promises"
import path from "node:path"

function contentTypeFor(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase()
    switch (ext) {
        case ".png":
            return "image/png"
        case ".jpg":
        case ".jpeg":
            return "image/jpeg"
        case ".webp":
            return "image/webp"
        case ".gif":
            return "image/gif"
        case ".svg":
            return "image/svg+xml"
        case ".ico":
            return "image/x-icon"
        default:
            return "application/octet-stream"
    }
}

export async function GET(
    _req: Request,
    { params }: { params: Promise<{ path: string[] }> },
) {
    try {
        const { path: segments } = await params
        if (!segments?.length) {
            return NextResponse.json({ message: "Not found" }, { status: 404 })
        }

        const uploadsRoot = path.resolve("public", "uploads")
        const requestedPath = path.resolve(uploadsRoot, ...segments)

        // Prevent path traversal outside public/uploads.
        if (!requestedPath.startsWith(uploadsRoot)) {
            return NextResponse.json({ message: "Not found" }, { status: 404 })
        }

        const data = await fs.readFile(requestedPath)
        return new NextResponse(new Uint8Array(data), {
            status: 200,
            headers: {
                "Content-Type": contentTypeFor(requestedPath),
                "Cache-Control": "public, max-age=31536000, immutable",
            },
        })
    } catch {
        return NextResponse.json({ message: "Not found" }, { status: 404 })
    }
}

