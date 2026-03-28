import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { logger } from "@/lib/logger"

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

/**
 * Prisma ORM 7+ uses the driver adapter for PostgreSQL.
 * Use `PoolConfig` (`connectionString`) so the adapter owns the pool — avoids
 * brittle bundling around a shared `pg.Pool` instance.
 */
const connectionString =
    process.env.DATABASE_URL ??
    "postgresql://postgres:postgres@127.0.0.1:5432/postgres"

const adapter = new PrismaPg({ connectionString })

export const prisma =
    globalForPrisma.prisma ??
    new PrismaClient({
        adapter,
        log:
            process.env.NODE_ENV === "development"
                ? ["error", "warn"]
                : ["error"],
    })

if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prisma
}

if (typeof window === "undefined") {
    void prisma.$connect().catch((error: unknown) => {
        if (process.env.NODE_ENV === "development") {
            logger.warn("Prisma connection warning", error)
        }
    })
}
