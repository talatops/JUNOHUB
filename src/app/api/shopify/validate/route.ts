import { NextResponse } from "next/server"
import { shopifyValidateSchema, validationErrorResponse } from "@/lib/api-schemas"
import { cleanShopifyDomain } from "@/lib/shopify/adminPing"

const TRANSIENT_ERROR_CODES = ["ETIMEDOUT", "ECONNRESET", "ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN"]
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 1500

function isTransientError(error: unknown): boolean {
    const err = error as { code?: string; cause?: { code?: string; errors?: Array<{ code?: string }> }; errors?: Array<{ code?: string }> }
    const code = err?.code ?? err?.cause?.code ?? err?.cause?.errors?.[0]?.code ?? err?.errors?.[0]?.code
    return code ? TRANSIENT_ERROR_CODES.includes(code) : false
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function POST(req: Request) {
    try {
        const raw = await req.json().catch(() => ({}))
        const parsed = shopifyValidateSchema.safeParse(raw)
        if (!parsed.success) {
            return validationErrorResponse(parsed.error)
        }
        const { domain, accessToken } = parsed.data

        const cleanDomain = cleanShopifyDomain(domain)

        let lastError: unknown = null

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), 10000)

            try {
                const response = await fetch(`https://${cleanDomain}/admin/api/2024-01/shop.json`, {
                    method: "GET",
                    headers: {
                        "X-Shopify-Access-Token": accessToken,
                        "Content-Type": "application/json"
                    },
                    signal: controller.signal
                })

                clearTimeout(timeoutId)

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}))
                    return NextResponse.json({
                        message: "Invalid credentials. Please verify your domain and access token.",
                        details: errorData
                    }, { status: response.status })
                }

                const data = await response.json()
                return NextResponse.json({
                    message: "Validation successful!",
                    shop: data.shop
                })
            } catch (fetchError: unknown) {
                clearTimeout(timeoutId)
                lastError = fetchError

                if (fetchError instanceof Error && fetchError.name === "AbortError") {
                    return NextResponse.json({ message: "Connection to Shopify timed out. Please check the domain." }, { status: 408 })
                }

                if (isTransientError(fetchError) && attempt < MAX_RETRIES) {
                    console.warn(`Shopify validation attempt ${attempt}/${MAX_RETRIES} failed (transient), retrying...`, fetchError)
                    await sleep(RETRY_DELAY_MS)
                    continue
                }

                throw fetchError
            }
        }

        throw lastError
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error"
        console.error("Shopify validation error:", error)
        return NextResponse.json({
            message: "Failed to connect to Shopify. Verify the domain is correct.",
            error: message
        }, { status: 500 })
    }
}
