import { prisma } from "@/lib/prisma"

export type ChatPair = { vendorUserId: string; supplierUserId: string }

/** Map session user + contact to vendor/supplier user ids for B2B chat. */
export async function resolveB2bChatPair(
    sessionUserId: string,
    contactUserId: string
): Promise<ChatPair | null> {
    const [sessionUser, contactUser] = await Promise.all([
        prisma.user.findUnique({
            where: { id: sessionUserId },
            select: { id: true, role: true },
        }),
        prisma.user.findUnique({
            where: { id: contactUserId },
            select: { id: true, role: true },
        }),
    ])
    if (!sessionUser || !contactUser) return null
    if (sessionUser.role === "VENDOR" && contactUser.role === "SUPPLIER") {
        return { vendorUserId: sessionUserId, supplierUserId: contactUserId }
    }
    if (sessionUser.role === "SUPPLIER" && contactUser.role === "VENDOR") {
        return { vendorUserId: contactUserId, supplierUserId: sessionUserId }
    }
    return null
}

export async function countConnectionsForPair(
    vendorUserId: string,
    supplierUserId: string
): Promise<number> {
    const sp = await prisma.supplierProfile.findUnique({
        where: { userId: supplierUserId },
        select: { id: true },
    })
    if (!sp) return 0
    return prisma.connection.count({
        where: {
            status: "CONNECTED",
            supplierId: sp.id,
            store: { userId: vendorUserId },
        },
    })
}

/** Returns true if this store is linked between the vendor and supplier users. */
export async function hasChatConnectionForStore(
    vendorUserId: string,
    supplierUserId: string,
    storeId: string
): Promise<boolean> {
    const sp = await prisma.supplierProfile.findUnique({
        where: { userId: supplierUserId },
        select: { id: true },
    })
    if (!sp) return false
    const conn = await prisma.connection.findFirst({
        where: {
            status: "CONNECTED",
            storeId,
            supplierId: sp.id,
            store: { userId: vendorUserId },
        },
        select: { id: true },
    })
    return !!conn
}
