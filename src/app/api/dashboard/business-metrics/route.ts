import { NextResponse } from "next/server"
import { format, startOfDay, startOfMonth, subDays, subMonths } from "date-fns"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { getVendorActiveStore } from "@/lib/dashboard/vendorActiveStore"

const ASSUMED_NET_MARGIN = 0.34
const PAYMENT_RATE = 0.019
const PLATFORM_RATE = 0.024

type DashboardRange = "7days" | "30days" | "1year"

function parseRange(input: string | null): DashboardRange {
    if (input === "30days" || input === "1year" || input === "7days") return input
    return "7days"
}

function rangeWindow(range: DashboardRange, now = new Date()) {
    if (range === "1year") {
        const since = startOfMonth(subMonths(now, 11))
        return {
            since,
            previousSince: startOfMonth(subMonths(now, 23)),
            bucketCount: 12,
            bucketKey: (date: Date) => format(startOfMonth(date), "yyyy-MM"),
            bucketLabel: (key: string) => {
                const [y, m] = key.split("-").map(Number)
                return format(new Date(y!, (m ?? 1) - 1, 1), "MMM")
            },
            previousLabel: "prior year",
        }
    }

    const days = range === "30days" ? 30 : 7
    const since = subDays(startOfDay(now), days - 1)
    return {
        since,
        previousSince: subDays(since, days),
        bucketCount: days,
        bucketKey: (date: Date) => format(startOfDay(date), "yyyy-MM-dd"),
        bucketLabel: (key: string) => format(new Date(`${key}T00:00:00`), "MMM d"),
        previousLabel: range === "30days" ? "prior 30 days" : "prior 7 days",
    }
}

function rangeKeys(config: ReturnType<typeof rangeWindow>): string[] {
    const keys: string[] = []
    for (let i = config.bucketCount - 1; i >= 0; i--) {
        const d =
            config.bucketCount === 12
                ? startOfMonth(subMonths(new Date(), i))
                : subDays(startOfDay(new Date()), i)
        keys.push(config.bucketKey(d))
    }
    return keys
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

export async function GET(req: Request) {
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

        const { searchParams } = new URL(req.url)
        const range = parseRange(searchParams.get("range"))
        const config = rangeWindow(range)

        const orders = await prisma.cachedOrder.findMany({
            where: {
                storeId: store.id,
                OR: [
                    { shopifyCreatedAt: { gte: config.previousSince } },
                    { shopifyCreatedAt: null, createdAt: { gte: config.previousSince } },
                ],
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

        const keys = rangeKeys(config)
        const grossByMonth: Record<string, number> = Object.fromEntries(keys.map((k) => [k, 0]))
        const refundByMonth: Record<string, number> = Object.fromEntries(keys.map((k) => [k, 0]))

        let gross = 0
        let refunds = 0
        let previousGross = 0
        let previousRefunds = 0

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
            const isCurrentPeriod = d >= config.since
            const isPreviousPeriod = d >= config.previousSince && d < config.since
            const mk = config.bucketKey(d)

            if (isCurrentPeriod) {
                if (isRefundLike) {
                    refunds += Math.abs(amt)
                    if (mk in refundByMonth) refundByMonth[mk] += Math.abs(amt)
                } else {
                    gross += amt
                    if (mk in grossByMonth) grossByMonth[mk] += amt
                }
            } else if (isPreviousPeriod) {
                if (isRefundLike) previousRefunds += Math.abs(amt)
                else previousGross += amt
            }

            const firstHalf = d < midpoint
            if (!isCurrentPeriod) continue
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
        const orderCount = orders.filter((o) => {
            const d = o.shopifyCreatedAt ?? o.createdAt
            return d >= config.since && !(o.financialStatus || "").toLowerCase().includes("refund")
        }).length
        const estimatedFees = gross * (PAYMENT_RATE + PLATFORM_RATE) + refunds * 0.02 + orderCount * 0.25
        const avgMarginPct =
            gross > 0 ? Math.round(((netProfitEstimate + refunds * 0.5) / gross) * 1000) / 10 : 0
        const previousNetProfitEstimate = Math.max(0, previousGross * ASSUMED_NET_MARGIN - previousRefunds * 0.5)
        const previousFees = previousGross * (PAYMENT_RATE + PLATFORM_RATE) + previousRefunds * 0.02
        const previousAvgMarginPct =
            previousGross > 0
                ? Math.round(((previousNetProfitEstimate + previousRefunds * 0.5) / previousGross) * 1000) / 10
                : 0

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

        function pctChangeValue(current: number, previous: number): number {
            const a = previous
            const b = current
            if (a === 0) return b > 0 ? 100 : 0
            return Math.round(((b - a) / a) * 1000) / 10
        }

        const kpis = [
            {
                key: "netProfit",
                label: "Est. net profit",
                value: netProfitEstimate,
                changePct: pctChangeValue(netProfitEstimate, previousNetProfitEstimate),
                sparkline: profitSpark,
            },
            {
                key: "grossRevenue",
                label: "Gross revenue",
                value: gross,
                changePct: pctChangeValue(gross, previousGross),
                sparkline: grossSpark,
            },
            {
                key: "fees",
                label: "Est. fees",
                value: estimatedFees,
                changePct: pctChangeValue(estimatedFees, previousFees),
                sparkline: feeSpark,
            },
            {
                key: "margin",
                label: "Avg. margin (est.)",
                value: avgMarginPct,
                suffix: "%",
                changePct: pctChangeValue(avgMarginPct, previousAvgMarginPct),
                sparkline: keys.map((_, i) => avgMarginPct + (i % 3) - 1),
            },
        ]

        const monthlyProfitBars = keys.map((k) => ({
            month: config.bucketLabel(k),
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
            range,
            comparisonLabel: config.previousLabel,
            disclaimer:
                "Financial figures include estimates (payment + platform fees, assumed ~34% net margin). Connect fuller accounting data for audited numbers.",
            kpis,
            monthlyProfitBars,
            feeDonut,
            feeTotal: Math.round(feeDonut.reduce((s, x) => s + x.value, 0) * 100) / 100,
            productMargins: productRows,
            aiInsight,
            totals: {
                gross,
                refunds,
                orders: orderCount,
            },
        })
    } catch (e) {
        console.error("[business-metrics]", e)
        return NextResponse.json({ message: "Failed to load metrics" }, { status: 500 })
    }
}
