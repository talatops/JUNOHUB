import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"
import crypto from "crypto"

// Prefer S3-specific env vars, fall back to generic AWS ones
const REGION =
    process.env.SUPPLIER_PRODUCT_IMAGES_REGION ||
    process.env.AWS_S3_REGION ||
    process.env.AWS_REGION ||
    process.env.AWS_DEFAULT_REGION ||
    "us-east-1"

const BUCKET =
    process.env.SUPPLIER_PRODUCT_IMAGES_BUCKET ||
    process.env.AWS_S3_BUCKET_NAME ||
    ""

const ACCESS_KEY_ID = process.env.AWS_S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID
const SECRET_ACCESS_KEY = process.env.AWS_S3_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY

if (!BUCKET) {
    // We intentionally don't throw here to avoid crashing the app in environments
    // where S3 hasn't been configured yet. The upload API will check and fail
    // gracefully with a 500 + clear message.
    // eslint-disable-next-line no-console
    console.warn(
        "[S3] SUPPLIER_PRODUCT_IMAGES_BUCKET or AWS_S3_BUCKET_NAME is not set. Supplier image uploads will fail."
    )
}

export const s3Client = new S3Client({
    region: REGION,
    credentials:
        ACCESS_KEY_ID && SECRET_ACCESS_KEY
            ? {
                  accessKeyId: ACCESS_KEY_ID,
                  secretAccessKey: SECRET_ACCESS_KEY
              }
            : undefined
})

export async function uploadSupplierProductImage(params: {
    supplierId: string
    fileBuffer: Buffer
    contentType?: string
    originalName?: string
}) {
    if (!BUCKET) {
        throw new Error("S3 bucket is not configured for supplier product images")
    }

    const extensionFromType =
        params.contentType && params.contentType.includes("/")
            ? params.contentType.split("/")[1]
            : undefined

    const ext =
        (params.originalName && params.originalName.split(".").pop()) ||
        extensionFromType ||
        "bin"

    const key = `supplier-products/${params.supplierId}/${crypto.randomUUID()}.${ext}`

    const command = new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: params.fileBuffer,
        ContentType: params.contentType
    })

    await s3Client.send(command)

    const url = `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`
    return { key, url }
}

export async function uploadStorefrontChatLogo(params: {
    vendorId: string
    fileBuffer: Buffer
    contentType?: string
    originalName?: string
}) {
    if (!BUCKET) {
        throw new Error("S3 bucket is not configured for storefront chat logo uploads")
    }

    const extensionFromType =
        params.contentType && params.contentType.includes("/")
            ? params.contentType.split("/")[1]
            : undefined

    const ext =
        (params.originalName && params.originalName.split(".").pop()) ||
        extensionFromType ||
        "bin"

    const key = `storefront-chat-logos/${params.vendorId}/${crypto.randomUUID()}.${ext}`

    const command = new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: params.fileBuffer,
        ContentType: params.contentType
    })

    await s3Client.send(command)

    const url = `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`
    return { key, url }
}

