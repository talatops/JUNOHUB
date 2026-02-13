import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime"
import { logger } from "@/lib/logger"

const AWS_REGION = process.env.AWS_REGION || "us-east-1"
const BEDROCK_CHAT_MODEL =
    process.env.BEDROCK_CHAT_MODEL || "anthropic.claude-3-haiku-20240307-v1:0"

// Initialize Bedrock client
const bedrockClient = new BedrockRuntimeClient({
    region: AWS_REGION,
    credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
        ? {
              accessKeyId: process.env.AWS_ACCESS_KEY_ID,
              secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          }
        : undefined, // Will use default credential chain (IAM role, etc.)
})

export interface ChatCompletionOptions {
    systemPrompt?: string
    maxTokens?: number
    temperature?: number
}

export async function chatCompletion(
    userMessage: string,
    options: ChatCompletionOptions = {},
): Promise<string> {
    const {
        systemPrompt = "",
        maxTokens = 512,
        temperature = 0.7,
    } = options

    try {
        // Claude Messages API format
        const requestBody = {
            anthropic_version: "bedrock-2023-05-31",
            max_tokens: maxTokens,
            temperature: temperature,
            system: systemPrompt,
            messages: [
                {
                    role: "user" as const,
                    content: userMessage,
                },
            ],
        }

        const command = new InvokeModelCommand({
            modelId: BEDROCK_CHAT_MODEL,
            contentType: "application/json",
            accept: "application/json",
            body: JSON.stringify(requestBody),
        })

        const response = await bedrockClient.send(command)

        if (!response.body) {
            logger.error("Empty response body from Bedrock chat API")
            return "I am unable to generate an answer at this time."
        }

        // Parse response body
        const responseBody = JSON.parse(
            new TextDecoder().decode(response.body),
        ) as {
            content?: Array<{
                type?: string
                text?: string
            }>
            stop_reason?: string
        }

        // Extract text from response
        const textContent = responseBody.content
            ?.filter((item) => item.type === "text")
            .map((item) => item.text || "")
            .join("")
            .trim()

        return textContent || "I am unable to generate an answer at this time."
    } catch (error) {
        logger.error("Bedrock chat completion failed", error)
        return "I am unable to generate an answer at this time."
    }
}
