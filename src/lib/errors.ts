import { NextResponse } from "next/server"
import { logger } from "./logger"

const isProd = process.env.NODE_ENV === "production"

export interface ApiError {
    code: string
    message: string
    details?: unknown
}

/**
 * Creates a standardized error response for API routes
 * In production, sanitizes error messages to prevent information disclosure
 */
export function createErrorResponse(
    status: number,
    message: string,
    code?: string,
    details?: unknown
): NextResponse<ApiError> {
    // In production, don't expose internal error details
    const safeMessage = isProd && status >= 500 
        ? "An internal error occurred. Please try again later."
        : message

    const error: ApiError = {
        code: code || `ERR_${status}`,
        message: safeMessage,
    }

    // Only include details in development
    if (!isProd && details !== undefined) {
        error.details = details
    }

    return NextResponse.json(error, { status })
}

/**
 * Handles errors in API routes with standardized responses
 */
export function handleApiError(error: unknown, context?: string): NextResponse<ApiError> {
    const contextMsg = context ? ` [${context}]` : ""
    
    if (error instanceof Error) {
        logger.error(`API error${contextMsg}`, error)
        
        // Handle known error types
        if (error.name === "PrismaClientKnownRequestError") {
            return createErrorResponse(400, "Database operation failed", "DB_ERROR")
        }
        
        if (error.name === "ValidationError") {
            return createErrorResponse(400, error.message, "VALIDATION_ERROR")
        }
        
        return createErrorResponse(500, error.message, "INTERNAL_ERROR")
    }
    
    logger.error(`Unknown error${contextMsg}`, error)
    return createErrorResponse(500, "An unexpected error occurred", "UNKNOWN_ERROR")
}
