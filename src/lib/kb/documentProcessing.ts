import fs from "fs/promises"
import path from "path"
import { logger } from "@/lib/logger"

export type RawDocument = {
    id: string
    storeId: string
    storagePath: string
    mimeType: string
}

export type TextChunk = {
    content: string
    documentId: string
    storeId: string
    sourceType: "DOCUMENT"
    metadata: Record<string, unknown>
}

const DEFAULT_CHUNK_SIZE = 1000
const DEFAULT_CHUNK_OVERLAP = 200

// Placeholder PDF/DOCX extraction – swap in real libraries (e.g. pdf-parse, docx) later.
async function extractTextFromFile(storagePath: string, mimeType: string): Promise<string> {
    try {
        const buffer = await fs.readFile(storagePath)
        const text = buffer.toString("utf8")

        // In a real implementation, branch on mimeType and use appropriate parsers.
        // For now, treat as UTF-8 text for a first iteration.
        return text
    } catch (error) {
        logger.error("Failed to extract text from file", { storagePath, mimeType, error })
        throw error
    }
}

function chunkText(
    text: string,
    documentId: string,
    storeId: string,
    sourceType: "DOCUMENT" = "DOCUMENT",
    chunkSize: number = DEFAULT_CHUNK_SIZE,
    overlap: number = DEFAULT_CHUNK_OVERLAP,
): TextChunk[] {
    const normalized = text.replace(/\r\n/g, "\n").trim()
    if (!normalized) return []

    const chunks: TextChunk[] = []
    let start = 0
    let chunkIndex = 0

    while (start < normalized.length) {
        const end = Math.min(start + chunkSize, normalized.length)
        const slice = normalized.slice(start, end)

        chunks.push({
            content: slice,
            documentId,
            storeId,
            sourceType,
            metadata: {
                chunkIndex,
            },
        })

        if (end === normalized.length) break

        start = end - overlap
        chunkIndex += 1
    }

    return chunks
}

export async function processRawDocument(raw: RawDocument): Promise<TextChunk[]> {
    const absolutePath = path.resolve(raw.storagePath)
    const text = await extractTextFromFile(absolutePath, raw.mimeType)
    return chunkText(text, raw.id, raw.storeId, "DOCUMENT")
}

