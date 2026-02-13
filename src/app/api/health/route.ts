import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { startGmailPoller } from "@/lib/gmail/poller"

export async function GET() {
    try {
        // Start the background Gmail poller (idempotent - safe to call repeatedly)
        startGmailPoller()

        // Simple database connectivity check
        await prisma.$queryRaw`SELECT 1`
        
        return NextResponse.json(
            { 
                status: "ok",
                timestamp: new Date().toISOString()
            },
            { status: 200 }
        )
    } catch (error) {
        console.error("Health check failed:", error)
        return NextResponse.json(
            { 
                status: "error",
                message: "Database connection failed"
            },
            { status: 503 }
        )
    }
}
