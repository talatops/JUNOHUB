import { NextResponse } from "next/server"
import { format, startOfMonth, subMonths } from "date-fns"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { getVendorActiveStore } from "@/lib/dashboard/vendorActiveStore"
import { classifyStorefrontCustomerQuery } from "@/lib/dashboard/storefrontQueryClassification"
import { buildModelEvaluationSnapshot } from "@/lib/dashboard/aiModelEvaluationSnapshot"

function median(nums: number[]): number {
    if (nums.length === 0) return 0
    const s = [...nums].sort((a, b) => a - b)
    const m = Math.floor(s.length / 2)
    return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2
}

function monthKeys(monthCount: number): string[] {
    const keys: string[] = []
    for (let i = monthCount - 1; i >= 0; i--) {
        keys.push(format(startOfMonth(subMonths(new Date(), i)), "yyyy-MM"))
    }
    return keys
}

function monthLabel(isoMonth: string): string {
    const [y, m] = isoMonth.split("-").map(Number)
    return format(new Date(y!, (m ?? 1) - 1, 1), "MMM")
}

export async function GET() {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }
        if (session.user.role !== "VENDOR") {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 })
        }

        const store = await getVendorActiveStore(session.user.id)
        if (!store) {
            return NextResponse.json({ message: "No active store" }, { status: 400 })
        }

        const vendorUserId = store.userId
        const since = startOfMonth(subMonths(new Date(), 5))

        const [
            storefrontMessages,
            gmailAutoReplies,
            attributedConversations,
            chatMessages,
        ] = await Promise.all([
            prisma.storefrontChatMessage.findMany({
                where: {
                    conversation: { storeId: store.id },
                    createdAt: { gte: since },
                },
                select: {
                    senderType: true,
                    createdAt: true,
                    content: true,
                    conversationId: true,
                },
                orderBy: [{ conversationId: "asc" }, { createdAt: "asc" }],
            }),
            prisma.gmailInboundAutoReply.findMany({
                where: { storeId: store.id, createdAt: { gte: since } },
                select: { createdAt: true },
            }),
            prisma.storefrontChatConversation.findMany({
                where: {
                    storeId: store.id,
                    boundShopifyOrderId: { not: null },
                    updatedAt: { gte: subMonths(new Date(), 1) },
                },
                select: {
                    id: true,
                    visitorId: true,
                    customerEmail: true,
                    boundShopifyOrderId: true,
                    updatedAt: true,
                },
                orderBy: { updatedAt: "desc" },
                take: 25,
            }),
            prisma.chatMessage.findMany({
                where: { storeId: store.id, createdAt: { gte: since } },
                select: { senderId: true, receiverId: true, createdAt: true },
                orderBy: { createdAt: "asc" },
                take: 8000,
            }),
        ])

        const keys = monthKeys(6)
        const aiShareByMonth: Record<string, { ai: number; cust: number }> = Object.fromEntries(
            keys.map((k) => [k, { ai: 0, cust: 0 }]),
        )
        const gmailByMonth: Record<string, number> = Object.fromEntries(keys.map((k) => [k, 0]))

        for (const g of gmailAutoReplies) {
            const k = format(startOfMonth(g.createdAt), "yyyy-MM")
            if (k in gmailByMonth) gmailByMonth[k] += 1
        }

        const intentCounts: Record<string, number> = {
            WISMO: 0,
            Returns: 0,
            "Product Qs": 0,
            Shipping: 0,
            General: 0,
        }

        const aiLatencySeconds: number[] = []
        const aiLatencyByMonth: Record<string, number[]> = Object.fromEntries(keys.map((k) => [k, []]))
        let pendingCustomer: { conversationId: string; createdAt: Date } | null = null

        for (const m of storefrontMessages) {
            const monthKey = format(startOfMonth(m.createdAt), "yyyy-MM")
            if (monthKey in aiShareByMonth) {
                if (m.senderType === "AI") aiShareByMonth[monthKey]!.ai += 1
                if (m.senderType === "CUSTOMER") aiShareByMonth[monthKey]!.cust += 1
            }

            if (m.senderType === "CUSTOMER") {
                intentCounts[classifyStorefrontCustomerQuery(m.content)] += 1
                pendingCustomer = { conversationId: m.conversationId, createdAt: m.createdAt }
            } else if (m.senderType === "AI" && pendingCustomer?.conversationId === m.conversationId) {
                const sec = (m.createdAt.getTime() - pendingCustomer.createdAt.getTime()) / 1000
                aiLatencySeconds.push(sec)
                const mk = format(startOfMonth(m.createdAt), "yyyy-MM")
                if (mk in aiLatencyByMonth) aiLatencyByMonth[mk]!.push(sec)
                pendingCustomer = null
            }
        }

        const automationSeries = keys.map((key) => {
            const { ai, cust } = aiShareByMonth[key] ?? { ai: 0, cust: 0 }
            const vol = ai + cust
            const storefrontAiSharePct = vol > 0 ? Math.round((ai / vol) * 1000) / 10 : 0
            return {
                monthKey: key,
                month: monthLabel(key),
                storefrontAiSharePct,
                gmailAutoReplies: gmailByMonth[key] ?? 0,
                volumes: { aiMessages: ai, customerMessages: cust },
            }
        })

        const manualLatencyMinutes: number[] = []
        const manualLatencyByMonth: Record<string, number[]> = Object.fromEntries(keys.map((k) => [k, []]))
        for (let i = 0; i < chatMessages.length - 1; i++) {
            const a = chatMessages[i]!
            const b = chatMessages[i + 1]!
            if (
                a.receiverId === vendorUserId &&
                a.senderId !== vendorUserId &&
                b.senderId === vendorUserId
            ) {
                const min = (b.createdAt.getTime() - a.createdAt.getTime()) / 60_000
                manualLatencyMinutes.push(min)
                const mk = format(startOfMonth(b.createdAt), "yyyy-MM")
                if (mk in manualLatencyByMonth) manualLatencyByMonth[mk]!.push(min)
            }
        }

        const responseTimeByMonth = keys.map((k) => ({
            month: monthLabel(k),
            aiMinutes: Math.round((median(aiLatencyByMonth[k] ?? []) / 60) * 10) / 10,
            manualMinutes: Math.round(median(manualLatencyByMonth[k] ?? []) * 10) / 10,
        }))

        const orderIds = attributedConversations
            .map((c) => c.boundShopifyOrderId)
            .filter(Boolean) as string[]

        const cachedOrders =
            orderIds.length > 0
                ? await prisma.cachedOrder.findMany({
                      where: {
                          storeId: store.id,
                          shopifyOrderId: { in: orderIds },
                      },
                      select: {
                          shopifyOrderId: true,
                          totalPrice: true,
                          currency: true,
                          orderNumber: true,
                      },
                  })
                : []

        const orderByShopifyId = new Map(cachedOrders.map((o) => [o.shopifyOrderId, o]))

        const attributedRows = attributedConversations
            .map((conv) => {
                const oid = conv.boundShopifyOrderId
                if (!oid) return null
                const o = orderByShopifyId.get(oid)
                const amt = o ? parseFloat(o.totalPrice || "0") : null
                const currency = o?.currency ?? "GBP"
                const hint =
                    conv.customerEmail?.split("@")[0]?.slice(0, 2).toUpperCase() ??
                    conv.visitorId.slice(0, 2).toUpperCase()
                return {
                    id: conv.id,
                    initials: hint.padEnd(2, "?"),
                    label:
                        conv.customerEmail?.replace(/(@.).+$/, "$1***") ??
                        `Visitor ${conv.visitorId.slice(-6)}`,
                    summary: o?.orderNumber ? `Order ${o.orderNumber}` : "Linked storefront session → order",
                    amount: amt,
                    currency,
                    channel: "AI" as const,
                    updatedAt: conv.updatedAt.toISOString(),
                }
            })
            .filter(Boolean)

        const attributedTotal = attributedRows.reduce((sum, r) => sum + (r?.amount ?? 0), 0)

        const signalEvents = storefrontMessages.length + gmailAutoReplies.length
        const modelEvaluation = buildModelEvaluationSnapshot(store.id, {
            signalEvents,
            monthLabels: automationSeries.map((r) => r.month),
        })

        return NextResponse.json({
            storeId: store.id,
            generatedAt: new Date().toISOString(),
            modelEvaluation,
            automationSeries,
            messageVolumeByType: Object.entries(intentCounts).map(([name, count]) => ({ name, count })),
            responseTime: {
                aiMedianSeconds: Math.round(median(aiLatencySeconds)),
                manualMedianMinutes: Math.round(median(manualLatencyMinutes) * 10) / 10,
                sampleAiPairs: aiLatencySeconds.length,
                sampleManualPairs: manualLatencyMinutes.length,
                byMonth: responseTimeByMonth,
            },
            attributedSupportSales: {
                totalAmount: Math.round(attributedTotal * 100) / 100,
                currency: cachedOrders[0]?.currency ?? "GBP",
                rows: attributedRows.slice(0, 12),
            },
            totals: {
                storefrontAiMessages: storefrontMessages.filter((m) => m.senderType === "AI").length,
                storefrontCustomerMessages: storefrontMessages.filter((m) => m.senderType === "CUSTOMER")
                    .length,
                gmailAutoReplies: gmailAutoReplies.length,
            },
        })
    } catch (e) {
        console.error("[ai-analytics]", e)
        return NextResponse.json({ message: "Failed to load analytics" }, { status: 500 })
    }
}
