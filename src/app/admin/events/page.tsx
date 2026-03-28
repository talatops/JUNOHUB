import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { Activity, Link2, Radar, Shuffle } from "lucide-react"

type AdminEventType = "CONNECTION" | "PRODUCT_SYNC" | "SYNC_HEALTH"

interface AdminEvent {
    id: string
    type: AdminEventType
    status: string
    timestamp: string
    storeName: string | null
    supplierName: string | null
    metadata?: Record<string, unknown>
}

const LIMIT = 50

async function getEvents(type?: AdminEventType): Promise<AdminEvent[]> {
    const [connectionEvents, productSyncEvents, syncHealthEvents] = await Promise.all([
        prisma.connection.findMany({
            orderBy: { createdAt: "desc" },
            take: LIMIT,
            include: { store: true, supplier: true },
        }),
        prisma.productSync.findMany({
            orderBy: { createdAt: "desc" },
            take: LIMIT,
            include: { store: true, supplier: true },
        }),
        prisma.syncMetadata.findMany({
            orderBy: { lastSyncAt: "desc" },
            take: LIMIT,
            include: { store: true },
        }),
    ])

    type ConnectionEventRow = (typeof connectionEvents)[number]
    type ProductSyncEventRow = (typeof productSyncEvents)[number]
    type SyncHealthEventRow = (typeof syncHealthEvents)[number]

    const events: AdminEvent[] = [
        ...connectionEvents.map((c: ConnectionEventRow) => ({
            id: c.id,
            type: "CONNECTION" as AdminEventType,
            status: c.status,
            timestamp: c.createdAt.toISOString(),
            storeName: c.store.shopifyStoreName,
            supplierName: c.supplier.companyName,
            metadata: {},
        })),
        ...productSyncEvents.map((p: ProductSyncEventRow) => ({
            id: p.id,
            type: "PRODUCT_SYNC" as AdminEventType,
            status: p.status,
            timestamp: p.createdAt.toISOString(),
            storeName: p.store.shopifyStoreName,
            supplierName: p.supplier.companyName,
            metadata: { productTitle: p.shopifyProductTitle, shopifyProductId: p.shopifyProductId },
        })),
        ...syncHealthEvents.map((s: SyncHealthEventRow) => ({
            id: s.id,
            type: "SYNC_HEALTH" as AdminEventType,
            status: s.syncStatus,
            timestamp: s.lastSyncAt.toISOString(),
            storeName: s.store.shopifyStoreName,
            supplierName: null as string | null,
            metadata: { resourceType: s.resourceType, recordCount: s.recordCount },
        })),
    ].filter((e) => !type || e.type === type)

    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    return events.slice(0, LIMIT)
}

function typeBadge(eventType: AdminEventType) {
    switch (eventType) {
        case "CONNECTION":
            return (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 text-blue-200 border border-blue-500/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                    <Link2 className="w-3 h-3" />
                    Connection
                </span>
            )
        case "PRODUCT_SYNC":
            return (
                <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/15 text-purple-200 border border-purple-500/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                    <Shuffle className="w-3 h-3" />
                    Product Sync
                </span>
            )
        case "SYNC_HEALTH":
            return (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 text-emerald-200 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                    <Radar className="w-3 h-3" />
                    Sync Health
                </span>
            )
        default:
            return null
    }
}

function statusBadge(status: string) {
    const normalized = status.toUpperCase()
    let colorClasses =
        "bg-slate-800/60 text-slate-200 border-slate-500/40"

    if (normalized === "CONNECTED" || normalized === "ACCEPTED" || normalized === "SUCCESS") {
        colorClasses = "bg-emerald-500/15 text-emerald-200 border-emerald-500/40"
    } else if (normalized === "PENDING" || normalized === "IN_PROGRESS") {
        colorClasses = "bg-amber-500/15 text-amber-200 border-amber-500/40"
    } else if (normalized === "REJECTED" || normalized === "FAILED") {
        colorClasses = "bg-rose-500/15 text-rose-200 border-rose-500/40"
    }

    return (
        <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide border ${colorClasses}`}
        >
            {normalized}
        </span>
    )
}

export default async function AdminEventsPage({
    searchParams,
}: {
    searchParams: Promise<{ type?: string }>
}) {
    const session = await auth()
    if (!session || session.user.role !== "ADMIN") {
        redirect("/login")
    }

    const { type } = await searchParams
    const filterType =
        type && ["CONNECTION", "PRODUCT_SYNC", "SYNC_HEALTH"].includes(type)
            ? (type as AdminEventType)
            : undefined

    const events = await getEvents(filterType)

    return (
        <div className="flex flex-col gap-6 h-full">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
                        Event Timeline
                    </h1>
                    <p className="text-sm text-slate-400 mt-1 max-w-2xl">
                        Chronological, read-only view of platform activity across connections,
                        product syncs, and sync health events.
                    </p>
                </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-4 flex flex-wrap gap-2">
                <span className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold mr-2">
                    Filter by type:
                </span>
                <div className="flex flex-wrap gap-2">
                    <FilterChip label="All" href="/admin/events" active={!filterType} />
                    <FilterChip
                        label="Connections"
                        href="/admin/events?type=CONNECTION"
                        active={filterType === "CONNECTION"}
                    />
                    <FilterChip
                        label="Product Syncs"
                        href="/admin/events?type=PRODUCT_SYNC"
                        active={filterType === "PRODUCT_SYNC"}
                    />
                    <FilterChip
                        label="Sync Health"
                        href="/admin/events?type=SYNC_HEALTH"
                        active={filterType === "SYNC_HEALTH"}
                    />
                </div>
            </div>

            <div className="flex-1 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-5 overflow-y-auto">
                {events.length === 0 ? (
                    <div className="h-full flex items-center justify-center">
                        <p className="text-sm text-slate-500">
                            No events found for the current filter.
                        </p>
                    </div>
                ) : (
                    <div className="relative">
                        <div className="absolute left-4 top-0 bottom-0 w-px bg-white/10" />
                        <div className="space-y-4">
                            {events.map((event) => (
                                <div
                                    key={event.id}
                                    className="relative pl-10 pr-2 py-2 group"
                                >
                                    <div className="absolute left-[14px] top-3 w-3 h-3 rounded-full bg-indigo-400 border-2 border-slate-900 shadow-md shadow-indigo-500/40" />
                                    <div className="rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 flex flex-col gap-1">
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                {typeBadge(event.type)}
                                                {statusBadge(event.status)}
                                            </div>
                                            <div className="flex items-center gap-1 text-[11px] text-slate-400">
                                                <Activity className="w-3 h-3" />
                                                <span>
                                                    {new Date(
                                                        event.timestamp,
                                                    ).toLocaleString("en-US", {
                                                        dateStyle: "short",
                                                        timeStyle: "short",
                                                    })}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="mt-1 text-xs text-slate-200">
                                            {event.storeName && (
                                                <span className="font-semibold">
                                                    {event.storeName}
                                                </span>
                                            )}
                                            {event.storeName && event.supplierName && (
                                                <span className="mx-1 text-slate-500">↔</span>
                                            )}
                                            {event.supplierName && (
                                                <span className="font-semibold">
                                                    {event.supplierName}
                                                </span>
                                            )}
                                            {!event.storeName && !event.supplierName && (
                                                <span className="text-slate-400">
                                                    Platform-level event
                                                </span>
                                            )}
                                        </div>
                                        {event.metadata && event.type === "PRODUCT_SYNC" && (
                                            <p className="text-[11px] text-slate-400 mt-0.5">
                                                {(event.metadata.productTitle as string) ||
                                                    "Product sync"}
                                            </p>
                                        )}
                                        {event.metadata && event.type === "SYNC_HEALTH" && (
                                            <p className="text-[11px] text-slate-400 mt-0.5">
                                                {String(
                                                    (event.metadata.resourceType ||
                                                        "unknown") as string,
                                                ).toUpperCase()}{" "}
                                                · Records:{" "}
                                                {String(
                                                    (event.metadata.recordCount ||
                                                        0) as number,
                                                )}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

function FilterChip({
    label,
    href,
    active,
}: {
    label: string
    href: string
    active: boolean
}) {
    return (
        <a
            href={href}
            className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                active
                    ? "border-white/20 bg-white/15 text-white"
                    : "border-white/10 bg-slate-900/40 text-slate-300 hover:bg-white/10"
            }`}
        >
            {label}
        </a>
    )
}

