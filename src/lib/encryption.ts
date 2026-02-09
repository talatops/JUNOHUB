import crypto from "crypto"

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 12 // 96-bit nonce is recommended for GCM
const AUTH_TAG_LENGTH = 16

/**
 * Returns a 32-byte encryption key derived from the MFA_ENCRYPTION_KEY env var.
 * Throws if the key is missing or too weak.
 */
function getKey(): Buffer {
    const raw = process.env.MFA_ENCRYPTION_KEY

    if (!raw) {
        throw new Error("MFA_ENCRYPTION_KEY is not set")
    }

    // Derive a 32-byte key from the provided secret using SHA-256
    return crypto.createHash("sha256").update(raw, "utf8").digest()
}

export interface EncryptedPayload {
    v: number
    iv: string
    tag: string
    data: string
}

/**
 * Encrypts a UTF-8 string value using AES-256-GCM.
 * Returns a compact JSON string that can be stored in the DB.
 */
export function encryptString(plaintext: string): string {
    const key = getKey()
    const iv = crypto.randomBytes(IV_LENGTH)

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
        authTagLength: AUTH_TAG_LENGTH,
    })

    const encrypted = Buffer.concat([
        cipher.update(plaintext, "utf8"),
        cipher.final(),
    ])
    const tag = cipher.getAuthTag()

    const payload: EncryptedPayload = {
        v: 1,
        iv: iv.toString("base64"),
        tag: tag.toString("base64"),
        data: encrypted.toString("base64"),
    }

    return JSON.stringify(payload)
}

/**
 * Decrypts a value previously produced by encryptString.
 * For backward compatibility, if the input is not a valid payload,
 * it will be returned as-is (assuming it is plaintext).
 */
export function decryptString(value: string | null): string | null {
    if (!value) return null

    try {
        const parsed = JSON.parse(value) as EncryptedPayload

        if (
            typeof parsed !== "object" ||
            parsed === null ||
            parsed.v !== 1 ||
            typeof parsed.iv !== "string" ||
            typeof parsed.tag !== "string" ||
            typeof parsed.data !== "string"
        ) {
            // Not our expected structure; treat as plaintext
            return value
        }

        const key = getKey()
        const iv = Buffer.from(parsed.iv, "base64")
        const tag = Buffer.from(parsed.tag, "base64")
        const encrypted = Buffer.from(parsed.data, "base64")

        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
            authTagLength: AUTH_TAG_LENGTH,
        })
        decipher.setAuthTag(tag)

        const decrypted = Buffer.concat([
            decipher.update(encrypted),
            decipher.final(),
        ])

        return decrypted.toString("utf8")
    } catch {
        // If anything goes wrong (invalid JSON, missing env, crypto error),
        // fall back to returning the original value to avoid locking users out.
        return value
    }
}

