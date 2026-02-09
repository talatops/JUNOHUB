/**
 * Script to fix domains with whitespace issues in the database
 * Run with: npx tsx scripts/fix-domains.ts
 * 
 * Make sure DATABASE_URL is set in your environment or .env file
 */

import "dotenv/config"
import pg from "pg"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client"
import { PrismaClientOptions } from "@prisma/client/runtime/client"

// Use the same setup as the main app
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ 
    adapter: adapter as unknown as PrismaClientOptions["adapter"] 
})

async function fixStoreDomains() {
    try {
        const stores = await prisma.store.findMany({
            select: {
                id: true,
                shopifyDomain: true,
            },
        })

        let fixed = 0
        for (const store of stores) {
            if (!store.shopifyDomain) continue

            // Clean domain: remove protocol, trailing slashes, and trim whitespace
            const cleanDomain = store.shopifyDomain.trim().replace(/^https?:\/\//, "").replace(/\/$/, "").trim()

            // Only update if domain changed
            if (cleanDomain !== store.shopifyDomain) {
                await prisma.store.update({
                    where: { id: store.id },
                    data: { shopifyDomain: cleanDomain },
                })
                console.log(`Fixed domain for store ${store.id}: "${store.shopifyDomain}" -> "${cleanDomain}"`)
                fixed++
            }
        }

        console.log(`\n✅ Fixed ${fixed} store domain(s) out of ${stores.length} total`)
        return { fixed, total: stores.length }
    } catch (error) {
        console.error("❌ Error fixing domains:", error)
        throw error
    } finally {
        await prisma.$disconnect()
        await pool.end()
    }
}

fixStoreDomains()
    .then(() => {
        process.exit(0)
    })
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
