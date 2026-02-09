import * as pg from "pg"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client"
import { logger } from "@/lib/logger"

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

// Initialize Prisma Client with proper error handling
let prismaClient: PrismaClient

if (globalForPrisma.prisma) {
    prismaClient = globalForPrisma.prisma
} else {
    try {
        prismaClient = new PrismaClient({ adapter: adapter as never })
        if (process.env.NODE_ENV !== "production") {
            globalForPrisma.prisma = prismaClient
        }
    } catch (error) {
        logger.error("Failed to initialize Prisma Client", error)
        throw error
    }
}

// Ensure Prisma client is up to date
if (typeof window === "undefined") {
    // Server-side only
    prismaClient.$connect().catch((error) => {
        // Ignore connection errors in development, but log them
        if (process.env.NODE_ENV === "development") {
            logger.warn("Prisma connection warning", error)
        }
    })
}

export const prisma = prismaClient
