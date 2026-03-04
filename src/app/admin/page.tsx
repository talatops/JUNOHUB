import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import {
    Activity,
    Link2,
    Shuffle,
    ShoppingCart,
    Store,
    Users
} from "lucide-react"

type ConnectionGroup = {
    status: string
    _count: { _all: number }
}

type ProductSyncGroup = {
    status: string
    _count: { _all: number }
}

type RecentSyncError = {
    id: string
    resourceType: string
    lastSyncAt: Date
    errorMessage: string | null
    store: {
        shopifyStoreName: string
    }
}

type RecentEvent = {
    id: string
    shopifyProductTitle: string
    status: string
    createdAt: Date
    store: {
        shopifyStoreName: string
    }
    supplier: {
        companyName: string
    }
}

interface AdminOverviewResult {
    storeCount: number
    supplierCount: number
    connectionStats: ConnectionGroup[]
    productSyncStats: ProductSyncGroup[]
    orderCount: number
    recentSyncErrors: RecentSyncError[]
    recentEvents: RecentEvent[]
}

async function getAdminOverview(): Promise<AdminOverviewResult> {
    const [
        storeCount,
        supplierCount,
        connectionStats,
        productSyncStats,
        orderCount,
        recentSyncErrors,
        recentEvents,
    ] = await Promise.all([
        prisma.store.count(),
        prisma.supplierProfile.count(),
        prisma.connection.groupBy({
            by: ["status"],
            _count: { _all: true },
        }) as unknown as Promise<ConnectionGroup[]>,
        prisma.productSync.groupBy({
            by: ["status"],
            _count: { _all: true },
        } as Parameters<typeof prisma.productSync.groupBy>[0]) as unknown as Promise<ProductSyncGroup[]>,
        prisma.cachedOrder.count(),
        prisma.syncMetadata.findMany({
            where: { syncStatus: { in: ["failed"] } },
            orderBy: { lastSyncAt: "desc" },
            take: 5,
            include: { store: true },
        }) as Promise<RecentSyncError[]>,
        prisma.productSync.findMany({
            orderBy: { createdAt: "desc" },
            take: 8,
            include: {
                store: true,
                supplier: true,
            },
        }) as Promise<RecentEvent[]>,
    ])

    return {
        storeCount,
        supplierCount,
        connectionStats,
        productSyncStats,
        orderCount,
        recentSyncErrors,
        recentEvents,
    }
}

export default async function AdminOverviewPage() {
    const session = await auth()
    if (!session || session.user.role !== "ADMIN") {
        redirect("/login")
    }

    const {
        storeCount,
        supplierCount,
        connectionStats,
        productSyncStats,
        orderCount,
        recentSyncErrors,
        recentEvents,
    } = await getAdminOverview()

    const connectedCount =
        connectionStats.find((c: ConnectionGroup) => c.status === "CONNECTED")?._count._all ?? 0
    const pendingConnections =
        connectionStats.find((c: ConnectionGroup) => c.status === "PENDING")?._count._all ?? 0
    const rejectedConnections =
        connectionStats.find((c: ConnectionGroup) => c.status === "REJECTED")?._count._all ?? 0

    const pendingSyncs =
        productSyncStats.find((c: ProductSyncGroup) => c.status === "PENDING")?._count._all ?? 0
    const acceptedSyncs =
        productSyncStats.find((c: ProductSyncGroup) => c.status === "ACCEPTED")?._count._all ?? 0
    const rejectedSyncs =
        productSyncStats.find((c: ProductSyncGroup) => c.status === "REJECTED")?._count._all ?? 0

    return (
        <div className="flex flex-col gap-8 h-full">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
                        Platform Overview
                    </h1>
                    <p className="text-sm text-slate-400 mt-1 max-w-xl">
                        High-level, read-only visibility into how data flows between Shopify
                        stores, vendors and suppliers across JUNO.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-5 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                            Vendors & Stores
                        </p>
                        <p className="text-3xl font-bold text-white mt-2">{storeCount}</p>
                        <p className="text-xs text-slate-500 mt-1">
                            Total Shopify stores connected
                        </p>
                    </div>
                    <div className="w-11 h-11 rounded-2xl bg-indigo-500/30 border border-indigo-400/40 flex items-center justify-center">
                        <Store className="w-6 h-6 text-indigo-200" />
                    </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-5 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                            Suppliers
                        </p>
                        <p className="text-3xl font-bold text-white mt-2">{supplierCount}</p>
                        <p className="text-xs text-slate-500 mt-1">
                            Active supplier profiles
                        </p>
                    </div>
                    <div className="w-11 h-11 rounded-2xl bg-emerald-500/30 border border-emerald-400/40 flex items-center justify-center">
                        <Users className="w-6 h-6 text-emerald-200" />
                    </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-5 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                            Orders Indexed
                        </p>
                        <p className="text-3xl font-bold text-white mt-2">{orderCount}</p>
                        <p className="text-xs text-slate-500 mt-1">
                            Cached Shopify orders across all stores
                        </p>
                    </div>
                    <div className="w-11 h-11 rounded-2xl bg-blue-500/30 border border-blue-400/40 flex items-center justify-center">
                        <ShoppingCart className="w-6 h-6 text-blue-200" />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
                <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-5 flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                Connections
                            </p>
                            <p className="text-sm text-slate-400 mt-1">
                                Vendor ↔ Supplier relationships
                            </p>
                        </div>
                        <div className="w-10 h-10 rounded-2xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center">
                            <Link2 className="w-5 h-5 text-blue-200" />
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 mt-2">
                        <div className="rounded-xl bg-slate-900/60 border border-white/10 p-3">
                            <p className="text-[11px] text-slate-400 uppercase tracking-wide">
                                Connected
                            </p>
                            <p className="text-xl font-semibold text-emerald-300 mt-1">
                                {connectedCount}
                            </p>
                        </div>
                        <div className="rounded-xl bg-slate-900/60 border border-white/10 p-3">
                            <p className="text-[11px] text-slate-400 uppercase tracking-wide">
                                Pending
                            </p>
                            <p className="text-xl font-semibold text-amber-300 mt-1">
                                {pendingConnections}
                            </p>
                        </div>
                        <div className="rounded-xl bg-slate-900/60 border border-white/10 p-3">
                            <p className="text-[11px] text-slate-400 uppercase tracking-wide">
                                Rejected
                            </p>
                            <p className="text-xl font-semibold text-rose-300 mt-1">
                                {rejectedConnections}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-5 flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                Product Syncs
                            </p>
                            <p className="text-sm text-slate-400 mt-1">
                                Vendor product sharing with suppliers
                            </p>
                        </div>
                        <div className="w-10 h-10 rounded-2xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center">
                            <Shuffle className="w-5 h-5 text-purple-200" />
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 mt-2">
                        <div className="rounded-xl bg-slate-900/60 border border-white/10 p-3">
                            <p className="text-[11px] text-slate-400 uppercase tracking-wide">
                                Pending
                            </p>
                            <p className="text-xl font-semibold text-amber-300 mt-1">
                                {pendingSyncs}
                            </p>
                        </div>
                        <div className="rounded-xl bg-slate-900/60 border border-white/10 p-3">
                            <p className="text-[11px] text-slate-400 uppercase tracking-wide">
                                Accepted
                            </p>
                            <p className="text-xl font-semibold text-emerald-300 mt-1">
                                {acceptedSyncs}
                            </p>
                        </div>
                        <div className="rounded-xl bg-slate-900/60 border border-white/10 p-3">
                            <p className="text-[11px] text-slate-400 uppercase tracking-wide">
                                Rejected
                            </p>
                            <p className="text-xl font-semibold text-rose-300 mt-1">
                                {rejectedSyncs}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-5 flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                Sync Health
                            </p>
                            <p className="text-sm text-slate-400 mt-1">
                                Recent sync failures across all stores
                            </p>
                        </div>
                        <div className="w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-400/30 flex items-center justify-center">
                            <Activity className="w-5 h-5 text-rose-200" />
                        </div>
                    </div>
                    <div className="space-y-2 mt-1 overflow-y-auto max-h-64">
                        {recentSyncErrors.length === 0 && (
                            <p className="text-xs text-slate-500">
                                No recent sync failures detected.
                            </p>
                        )}
                        {recentSyncErrors.map((sync: RecentSyncError) => (
                            <div
                                key={sync.id}
                                className="rounded-xl bg-slate-900/60 border border-rose-500/40 p-3"
                            >
                                <p className="text-xs font-semibold text-rose-200">
                                    {sync.resourceType.toUpperCase()} ·{" "}
                                    {sync.store.shopifyStoreName}
                                </p>
                                <p className="text-[11px] text-slate-300 mt-1 line-clamp-2">
                                    {sync.errorMessage || "Unknown error"}
                                </p>
                                <p className="text-[10px] text-slate-500 mt-1">
                                    Last attempt:{" "}
                                    {sync.lastSyncAt.toLocaleString("en-US", {
                                        dateStyle: "short",
                                        timeStyle: "short",
                                    })}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-5 flex flex-col gap-3 min-h-[220px]">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                            Recent Events
                        </p>
                        <p className="text-sm text-slate-400 mt-1">
                            Latest product sync activity across the network
                        </p>
                    </div>
                    <div className="w-10 h-10 rounded-2xl bg-slate-900/70 border border-white/10 flex items-center justify-center">
                        <Activity className="w-5 h-5 text-slate-200" />
                    </div>
                </div>
                <div className="mt-1 space-y-2 overflow-y-auto">
                    {recentEvents.length === 0 && (
                        <p className="text-xs text-slate-500">
                            No recent product sync events.
                        </p>
                    )}
                    {recentEvents.map((event: RecentEvent) => (
                        <div
                            key={event.id}
                            className="flex items-start gap-3 rounded-xl bg-slate-900/60 border border-white/10 px-3 py-2.5"
                        >
                            <div className="mt-1">
                                <Shuffle className="w-4 h-4 text-purple-300" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs text-slate-200">
                                    <span className="font-semibold">
                                        {event.store.shopifyStoreName}
                                    </span>{" "}
                                    ↔{" "}
                                    <span className="font-semibold">
                                        {event.supplier.companyName}
                                    </span>
                                </p>
                                <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                                    {event.shopifyProductTitle}
                                </p>
                                <p className="text-[10px] text-slate-500 mt-0.5">
                                    Status:{" "}
                                    <span className="font-medium text-slate-300">
                                        {event.status}
                                    </span>{" "}
                                    ·{" "}
                                    {event.createdAt.toLocaleString("en-US", {
                                        dateStyle: "short",
                                        timeStyle: "short",
                                    })}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

