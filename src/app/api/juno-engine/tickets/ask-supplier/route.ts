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
import { postB2bChatMessage } from "@/lib/chat/postB2bChatMessage"
import {
    isAskSupplierTicketRateLimited,
    logSupplierAutomation,
} from "@/lib/automation/supplierAutomationRate"

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

const ASK_SUPPLIER_MAX_PER_TICKET_HOUR = 20

const postBodySchema = z.object({
    orderRef: z.string().trim().min(1).max(120),
    ticketKey: z.string().trim().min(1).max(600),
    supplierUserId: z.string().trim().min(1).max(128),
    message: z.string().min(1).max(16_000),
    /** If set, only include these line indices for this supplier (must appear in their group). */
    lineIndices: z.array(z.number().int().nonnegative()).optional(),
})

/**
 * GET — preview supplier groups for an order reference.
 */
export async function GET(req: Request) {
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

        const { searchParams } = new URL(req.url)
        const orderRef = (searchParams.get("orderRef") || "").trim()
        if (!orderRef) {
            return NextResponse.json({ message: "orderRef is required" }, { status: 400 })
        }

        const order = await findCachedOrderForStore({ storeId, orderRef })
        if (!order) {
            return NextResponse.json({
                order: null,
                groups: [],
                message: "Order not found in cache. Sync orders or check the order number.",
            })
        }

        const groups = await groupLineItemsBySupplier({
            storeId,
            lines: order.lineItems,
        })

        return NextResponse.json({
            order: {
                shopifyOrderId: order.shopifyOrderId,
                orderNumber: order.orderNumber,
            },
            groups: groups.map((g) => ({
                supplierUserId: g.supplierUserId,
                companyName: g.companyName,
                lines: g.lines,
            })),
        })
    } catch (error) {
        logger.error("ask-supplier GET failed", error)
        return NextResponse.json({ message: "Failed to load preview" }, { status: 500 })
    }
}

/**
 * POST — send vendor message to one supplier (scoped lines appended in header).
 */
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
        const parsed = postBodySchema.safeParse(raw)
        if (!parsed.success) {
            return NextResponse.json(
                { message: "Invalid body", issues: parsed.error.flatten() },
                { status: 400 },
            )
        }

        const { orderRef, ticketKey, supplierUserId, message, lineIndices } = parsed.data

        const limited = await isAskSupplierTicketRateLimited(
            storeId,
            ticketKey,
            ASK_SUPPLIER_MAX_PER_TICKET_HOUR,
        )
        if (limited) {
            return NextResponse.json(
                { message: "Too many supplier messages for this ticket. Try again later." },
                { status: 429 },
            )
        }

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
                { message: "No linked supplier found for this order and supplier" },
                { status: 400 },
            )
        }

        let linesForMessage: LineItemForRouting[] = group.lines
        if (lineIndices?.length) {
            const set = new Set(lineIndices)
            linesForMessage = group.lines.filter((l) => set.has(l.lineIndex))
            if (!linesForMessage.length) {
                return NextResponse.json(
                    { message: "No matching line items for the given indices" },
                    { status: 400 },
                )
            }
        }

        const linesBlock = linesForMessage
            .map(
                (l) =>
                    `  - ${l.title}${l.sku ? ` (SKU ${l.sku})` : ""} × ${l.quantity} [product ${l.shopifyProductId ?? "?"}]`,
            )
            .join("\n")

        const header = [
            `[Ticket → supplier inquiry]`,
            `Ticket: ${ticketKey.slice(0, 400)}`,
            `Order #${order.orderNumber} (Shopify id ${order.shopifyOrderId})`,
            `Items discussed:`,
            linesBlock,
            "",
        ].join("\n")

        const fullMessage = `${header}${message.replace(/\0/g, "").trim()}`

        const posted = await postB2bChatMessage({
            senderId: session.user.id,
            receiverId: supplierUserId,
            storeId,
            kind: "TEXT",
            content: fullMessage,
            notify: true,
        })

        if (!posted.ok) {
            logger.warn("ask-supplier POST chat failed", {
                reason: posted.reason,
                storeId,
                supplierUserId,
            })
            return NextResponse.json(
                { message: "Could not send chat (check supplier connection)" },
                { status: 400 },
            )
        }

        await logSupplierAutomation({
            storeId,
            kind: "ASK_SUPPLIER",
            supplierUserId,
            ticketKey,
            messagePreview: fullMessage.slice(0, 500),
        })

        return NextResponse.json({ success: true, messageId: posted.messageId })
    } catch (error) {
        logger.error("ask-supplier POST failed", error)
        return NextResponse.json({ message: "Failed to send" }, { status: 500 })
    }
}
