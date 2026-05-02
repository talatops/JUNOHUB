import { prisma } from "@/lib/prisma"

/** Active vendor store (matches StoreSwitcher / Shopify cache routes). */
export async function getVendorActiveStore(userId: string) {
    return prisma.store.findFirst({
        where: { userId, isActive: true },
        select: { id: true, userId: true, businessName: true },
    })
}
