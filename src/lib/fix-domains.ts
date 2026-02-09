/**
 * Utility script to fix domains with whitespace issues in the database
 * Run this once to clean up existing bad data
 */

import { prisma } from "./prisma"

export async function fixStoreDomains() {
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

        console.log(`Fixed ${fixed} store domain(s)`)
        return { fixed, total: stores.length }
    } catch (error) {
        console.error("Error fixing domains:", error)
        throw error
    }
}

// Run if called directly (for testing)
if (require.main === module) {
    fixStoreDomains()
        .then((result) => {
            console.log("Domain fix completed:", result)
            process.exit(0)
        })
        .catch((error) => {
            console.error("Domain fix failed:", error)
            process.exit(1)
        })
}
