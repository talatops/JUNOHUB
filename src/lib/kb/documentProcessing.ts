import fs from "fs/promises"
import path from "path"
import { PDFParse } from "pdf-parse"
import mammoth from "mammoth"
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

const PDF_MIME = "application/pdf"
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
const DOC_MIME = "application/msword"

async function extractTextFromFile(storagePath: string, mimeType: string): Promise<string> {
    const absolutePath = path.resolve(storagePath)
    try {
        if (mimeType === PDF_MIME) {
            const buffer = await fs.readFile(absolutePath)
            const parser = new PDFParse({ data: buffer })
            try {
                const result = await parser.getText()
                await parser.destroy()
                return (result.text ?? "").trim()
            } finally {
                await parser.destroy().catch(() => {})
            }
        }
        if (mimeType === DOCX_MIME || mimeType === DOC_MIME) {
            const result = await mammoth.extractRawText({ path: absolutePath })
            return (result.value ?? "").trim()
        }
        // Fallback for plain text or unknown types
        const buffer = await fs.readFile(absolutePath)
        return buffer.toString("utf8").trim()
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

