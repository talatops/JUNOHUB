import { NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/auth"
import { isVendorPortalRole } from "@/lib/auth-roles"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import {
    findCachedOrderForStore,
    groupLineItemsBySupplier,
    type LineItemForRouting,
} from "@/lib/automation/ticketSupplierRouting"
import { draftAskSupplierMessage } from "@/lib/automation/askSupplierDraft"

async function getActiveStoreId(userId: string): Promise<string | null> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            activeStoreId: true,
            stores: { where: { isActive: true }, take: 1, select: { id: true } },
        },
    })
    return user?.activeStoreId ?? user?.stores[0]?.id ?? null
}

const bodySchema = z.object({
    orderRef: z.string().trim().min(1).max(120),
    supplierUserId: z.string().trim().min(1).max(128),
    ticketSnippet: z.string().max(8000).optional(),
    lineIndices: z.array(z.number().int().nonnegative()).optional(),
})

export async function POST(req: Request) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }
        if (!isVendorPortalRole(session.user.role)) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 })
        }

        const storeId = await getActiveStoreId(session.user.id)
        if (!storeId) {
            return NextResponse.json({ message: "No active store" }, { status: 400 })
        }

        const raw = await req.json().catch(() => ({}))
        const parsed = bodySchema.safeParse(raw)
        if (!parsed.success) {
            return NextResponse.json(
                { message: "Invalid body", issues: parsed.error.flatten() },
                { status: 400 },
            )
        }

        const store = await prisma.store.findFirst({
            where: { id: storeId, userId: session.user.id },
            select: { businessName: true },
        })
        if (!store) {
            return NextResponse.json({ message: "Store not found" }, { status: 404 })
        }

        const { orderRef, supplierUserId, ticketSnippet, lineIndices } = parsed.data

        const order = await findCachedOrderForStore({ storeId, orderRef })
        if (!order) {
            return NextResponse.json({ message: "Order not found in cache" }, { status: 404 })
        }

        const groups = await groupLineItemsBySupplier({
            storeId,
            lines: order.lineItems,
        })
        const group = groups.find((g) => g.supplierUserId === supplierUserId)
        if (!group) {
            return NextResponse.json(
                { message: "No linked supplier for this order" },
                { status: 400 },
            )
        }

        let lines: LineItemForRouting[] = group.lines
        if (lineIndices?.length) {
            const set = new Set(lineIndices)
            lines = group.lines.filter((l) => set.has(l.lineIndex))
            if (!lines.length) {
                return NextResponse.json(
                    { message: "No matching line items" },
                    { status: 400 },
                )
            }
        }

        const draft = await draftAskSupplierMessage({
            storeName: store.businessName,
            orderNumber: order.orderNumber,
            shopifyOrderId: order.shopifyOrderId,
            supplierCompanyName: group.companyName,
            lines,
            ticketSnippet: ticketSnippet?.trim() || "(no snippet)",
        })

        if (!draft) {
            return NextResponse.json(
                { message: "Draft unavailable (check GROQ_API_KEY)" },
                { status: 503 },
            )
        }

        return NextResponse.json({ draft })
    } catch (error) {
        logger.error("ask-supplier draft failed", error)
        return NextResponse.json({ message: "Failed to draft" }, { status: 500 })
    }
}
