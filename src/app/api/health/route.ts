import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
    try {
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
