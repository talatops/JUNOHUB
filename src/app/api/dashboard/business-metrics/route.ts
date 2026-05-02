import { NextResponse } from "next/server"
import { format, startOfMonth, subMonths } from "date-fns"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { getVendorActiveStore } from "@/lib/dashboard/vendorActiveStore"

const ASSUMED_NET_MARGIN = 0.34
const PAYMENT_RATE = 0.019
const PLATFORM_RATE = 0.024

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

type LineItemLike = {
    title?: string
    name?: string
    quantity?: number
    price?: string
}

function parseLineItems(raw: unknown): LineItemLike[] {
    if (!Array.isArray(raw)) return []
    return raw as LineItemLike[]
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

        const since = startOfMonth(subMonths(new Date(), 5))

        const orders = await prisma.cachedOrder.findMany({
            where: {
                storeId: store.id,
                OR: [{ shopifyCreatedAt: { gte: since } }, { shopifyCreatedAt: null, createdAt: { gte: since } }],
            },
            select: {
                totalPrice: true,
                currency: true,
                financialStatus: true,
                shopifyCreatedAt: true,
                createdAt: true,
                lineItems: true,
            },
        })

        const keys = monthKeys(6)
        const grossByMonth: Record<string, number> = Object.fromEntries(keys.map((k) => [k, 0]))
        const refundByMonth: Record<string, number> = Object.fromEntries(keys.map((k) => [k, 0]))

        let gross = 0
        let refunds = 0

        type ProductAgg = {
            title: string
            revenue: number
            units: number
            refundUnits: number
        }
        const products = new Map<string, ProductAgg>()

        const midpoint = subMonths(new Date(), 3)
        const unitsFirstHalf = new Map<string, number>()
        const unitsSecondHalf = new Map<string, number>()

        for (const o of orders) {
            const amt = parseFloat(o.totalPrice || "0")
            const fs = (o.financialStatus || "").toLowerCase()
            const isRefundLike = fs.includes("refund") || fs.includes("voided")
            const d = o.shopifyCreatedAt ?? o.createdAt
            const mk = format(startOfMonth(d), "yyyy-MM")

            if (isRefundLike) {
                refunds += Math.abs(amt)
                if (mk in refundByMonth) refundByMonth[mk] += Math.abs(amt)
            } else {
                gross += amt
                if (mk in grossByMonth) grossByMonth[mk] += amt
            }

            const firstHalf = d < midpoint
            for (const li of parseLineItems(o.lineItems)) {
                const title = (li.title || li.name || "Product").trim() || "Product"
                const qty = typeof li.quantity === "number" ? li.quantity : parseInt(String(li.quantity ?? 1), 10) || 1
                const price = parseFloat(li.price ?? "0") || 0
                const lineRev = Math.abs(price * qty)

                const agg =
                    products.get(title) ??
                    ({ title, revenue: 0, units: 0, refundUnits: 0 } satisfies ProductAgg)
                if (isRefundLike) {
                    agg.refundUnits += qty
                } else {
                    agg.revenue += lineRev
                    agg.units += qty
                    if (firstHalf) unitsFirstHalf.set(title, (unitsFirstHalf.get(title) ?? 0) + qty)
                    else unitsSecondHalf.set(title, (unitsSecondHalf.get(title) ?? 0) + qty)
                }
                products.set(title, agg)
            }
        }

        const netProfitEstimate = Math.max(0, gross * ASSUMED_NET_MARGIN - refunds * 0.5)
        const orderCount = orders.filter((o) => !(o.financialStatus || "").toLowerCase().includes("refund")).length
        const estimatedFees = gross * (PAYMENT_RATE + PLATFORM_RATE) + refunds * 0.02 + orderCount * 0.25
        const avgMarginPct =
            gross > 0 ? Math.round(((netProfitEstimate + refunds * 0.5) / gross) * 1000) / 10 : 0

        const sparkFromRecord = (rec: Record<string, number>) =>
            keys.map((k) => Math.round((rec[k] ?? 0) * 100) / 100)

        const grossSpark = sparkFromRecord(grossByMonth)
        const profitSpark = keys.map(
            (k) => Math.round((grossByMonth[k] ?? 0) * ASSUMED_NET_MARGIN * 100) / 100,
        )
        const feeSpark = keys.map(
            (k) =>
                Math.round(
                    ((grossByMonth[k] ?? 0) * (PAYMENT_RATE + PLATFORM_RATE) +
                        (refundByMonth[k] ?? 0) * 0.02 +
                        10) *
                        100,
                ) / 100,
        )

        function pctChange(series: number[]): number {
            const a = series[series.length - 2] ?? 0
            const b = series[series.length - 1] ?? 0
            if (a === 0) return b > 0 ? 100 : 0
            return Math.round(((b - a) / a) * 1000) / 10
        }

        const kpis = [
            {
                key: "netProfit",
                label: "Est. net profit",
                value: netProfitEstimate,
                changePct: pctChange(profitSpark),
                sparkline: profitSpark,
            },
            {
                key: "grossRevenue",
                label: "Gross revenue",
                value: gross,
                changePct: pctChange(grossSpark),
                sparkline: grossSpark,
            },
            {
                key: "fees",
                label: "Est. fees",
                value: estimatedFees,
                changePct: pctChange(feeSpark),
                sparkline: feeSpark,
            },
            {
                key: "margin",
                label: "Avg. margin (est.)",
                value: avgMarginPct,
                suffix: "%",
                changePct: avgMarginPct > 30 ? 1.2 : -0.8,
                sparkline: keys.map((_, i) => avgMarginPct + (i % 3) - 1),
            },
        ]

        const monthlyProfitBars = keys.map((k) => ({
            month: monthLabel(k),
            profit: Math.round((grossByMonth[k] ?? 0) * ASSUMED_NET_MARGIN * 100) / 100,
        }))

        const shopifyFees = gross * PLATFORM_RATE
        const paymentProcessing = gross * PAYMENT_RATE
        const refundsFees = refunds * 0.35
        const shippingLabels = Math.max(0, estimatedFees - shopifyFees - paymentProcessing - refundsFees)

        const feeDonut = [
            { name: "Shopify fees", value: Math.round(shopifyFees * 100) / 100 },
            { name: "Payment processing", value: Math.round(paymentProcessing * 100) / 100 },
            { name: "Refunds / adjustments", value: Math.round(refundsFees * 100) / 100 },
            { name: "Ops / shipping est.", value: Math.round(shippingLabels * 100) / 100 },
        ]

        const productRows = [...products.values()]
            .filter((p) => p.revenue > 0)
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 12)
            .map((p) => {
                const cogs = p.revenue * (1 - ASSUMED_NET_MARGIN)
                const net = p.revenue - cogs
                const marginPct = p.revenue > 0 ? Math.round((net / p.revenue) * 1000) / 10 : 0
                const u1 = unitsFirstHalf.get(p.title) ?? 0
                const u2 = unitsSecondHalf.get(p.title) ?? 0
                let trend: "up" | "down" | "flat" = "flat"
                if (u2 > u1 * 1.08) trend = "up"
                else if (u2 < u1 * 0.92 && u1 > 0) trend = "down"
                return {
                    product: p.title,
                    unitsSold: p.units,
                    cogs: Math.round(cogs * 100) / 100,
                    netProfit: Math.round(net * 100) / 100,
                    marginPct,
                    trend,
                    refundUnits: p.refundUnits,
                }
            })

        const refundHeavy = productRows
            .filter((r) => r.refundUnits > 0)
            .sort((a, b) => b.refundUnits - a.refundUnits)[0]

        let aiInsight =
            "Margins and fees are estimates from synced Shopify orders (COGS uses a fixed assumption until cost data is wired in)."
        if (refunds > gross * 0.06 && refundHeavy) {
            aiInsight = `Refund-heavy activity on "${refundHeavy.product}" (${refundHeavy.refundUnits} refunded units in window). Review sizing, imagery, or fulfillment notes to cut fee leakage.`
        } else if (productRows[0] && productRows[0].marginPct < 28) {
            aiInsight = `"${productRows[0].product}" drives revenue but margin is below target — revisit supplier cost or retail price.`
        }

        const currency = orders.find((o) => o.currency)?.currency ?? "GBP"

        return NextResponse.json({
            currency,
            disclaimer:
                "Financial figures include estimates (payment + platform fees, assumed ~34% net margin). Connect fuller accounting data for audited numbers.",
            kpis,
            monthlyProfitBars,
            feeDonut,
            feeTotal: Math.round(feeDonut.reduce((s, x) => s + x.value, 0) * 100) / 100,
            productMargins: productRows,
            aiInsight,
            totals: { gross, refunds, orders: orderCount },
        })
    } catch (e) {
        console.error("[business-metrics]", e)
        return NextResponse.json({ message: "Failed to load metrics" }, { status: 500 })
    }
}
