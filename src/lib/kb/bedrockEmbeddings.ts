import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime"
import { logger } from "@/lib/logger"

const AWS_REGION = process.env.AWS_REGION || "us-east-1"
// Hard-code Titan Text Embeddings v2 so all embeddings go through this model
const BEDROCK_EMBEDDING_MODEL = "amazon.titan-embed-text-v2:0"

/**
 * AWS Bedrock Rate Limits:
 * - Titan Text Embeddings V2: 2,000 requests/minute (~33 req/sec)
 * - We use 2-second delays between requests (30 req/min) to stay well under the limit
 * - Throttling errors trigger exponential backoff: 5s, 10s, 20s, 40s, 80s
 */

// Initialize Bedrock client with retry configuration
const bedrockClient = new BedrockRuntimeClient({
    region: AWS_REGION,
    credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
        ? {
              accessKeyId: process.env.AWS_ACCESS_KEY_ID,
              secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          }
        : undefined, // Will use default credential chain (IAM role, etc.)
    maxAttempts: 5, // AWS SDK default retry attempts
})

if (!process.env.AWS_ACCESS_KEY_ID && !process.env.AWS_SECRET_ACCESS_KEY) {
    logger.warn(
        "AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are not set. Bedrock will use default credential chain.",
    )
}

/**
 * Retry helper with exponential backoff for throttling errors
 */
async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 5,
    baseDelay: number = 5000, // Start with 5 seconds for throttling
): Promise<T> {
    let lastError: unknown

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn()
        } catch (error: any) {
            lastError = error

            // Check if it's a throttling error
            const isThrottling =
                error?.name === "ThrottlingException" ||
                error?.$metadata?.httpStatusCode === 429 ||
                error?.message?.includes("Too many requests")

            if (isThrottling && attempt < maxRetries) {
                // Exponential backoff with longer delays: 5s, 10s, 20s, 40s, 80s
                const delay = baseDelay * Math.pow(2, attempt)
                logger.warn(
                    `Bedrock throttling detected, retrying in ${delay / 1000}s (attempt ${attempt + 1}/${maxRetries + 1})`,
                )
                await new Promise((resolve) => setTimeout(resolve, delay))
                continue
            }

            // If not throttling or max retries reached, throw
            throw error
        }
    }

    throw lastError
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return []

    const results: number[][] = []
    // AWS Bedrock Titan V2 limit: 2000 requests/minute = ~33 req/sec
    // Use 2 seconds delay to stay well under limit (30 req/min = safe margin)
    const REQUEST_DELAY = 2000 // 2 seconds between requests

    for (let i = 0; i < texts.length; i++) {
        const text = texts[i]
        const trimmed = text.trim()
        if (!trimmed) {
            results.push([])
            continue
        }

        try {
            // Titan Text Embeddings V2 request format
            const requestBody = {
                inputText: trimmed,
                dimensions: 1024, // Use 1024 dimensions to match database schema
            }

            const command = new InvokeModelCommand({
                modelId: BEDROCK_EMBEDDING_MODEL,
                contentType: "application/json",
                accept: "application/json",
                body: JSON.stringify(requestBody),
            })

            // Use retry logic with exponential backoff
            const response = await retryWithBackoff(async () => {
                return await bedrockClient.send(command)
            })

            if (!response.body) {
                logger.error("Empty response body from Bedrock embedding API")
                results.push([])
                continue
            }

            // Parse response body
            const responseBody = JSON.parse(
                new TextDecoder().decode(response.body),
            ) as {
                embedding?: number[]
                inputTokenCount?: number
            }

            const vector = responseBody.embedding
            if (!vector || !Array.isArray(vector)) {
                logger.error("Invalid embedding response from Bedrock", responseBody)
                results.push([])
                continue
            }

            // Verify dimension matches expected (1024)
            if (vector.length !== 1024) {
                logger.warn(
                    `Expected 1024 dimensions but got ${vector.length}. Truncating or padding as needed.`,
                )
                // Pad or truncate to 1024
                if (vector.length < 1024) {
                    vector.push(...new Array(1024 - vector.length).fill(0))
                } else {
                    vector.splice(1024)
                }
            }

            results.push(vector)

            // Add delay between requests to avoid rate limiting (except for last request)
            if (i < texts.length - 1) {
                await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY))
            }
        } catch (error: any) {
            const isThrottling =
                error?.name === "ThrottlingException" ||
                error?.$metadata?.httpStatusCode === 429 ||
                error?.message?.includes("Too many requests")

            if (isThrottling) {
                logger.error(
                    `Bedrock throttling error after retries for text ${i + 1}/${texts.length}`,
                    error,
                )
            } else {
                logger.error(`Bedrock embedding request failed for text ${i + 1}/${texts.length}`, error)
            }
            // On any error, push an empty vector and continue.
            results.push([])
        }
    }

    return results
}
