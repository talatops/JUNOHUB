import { NextResponse } from "next/server"
import type { ZodError } from "zod"

/** Standard 400 for Zod failures (field + message for client UX). */
export function validationErrorResponse(error: ZodError) {
    const first = error.issues[0]
    return NextResponse.json(
        {
            message: first?.message ?? "Invalid input",
            field: first?.path?.length ? first.path.join(".") : undefined,
        },
        { status: 400 },
    )
}
