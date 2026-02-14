import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { Activity, Radar } from "lucide-react"

interface AdminSyncMetadata {
    id: string
    resourceType: string
    lastSyncAt: string
    syncStatus: string
    recordCount: number
    errorMessage: string | null
    store: {
        businessName: string
        shopifyStoreName: string
    }
}

async function getSyncHealth(): Promise<AdminSyncMetadata[]> {
    const rows = await prisma.syncMetadata.findMany({
        include: {
            store: {
                select: { businessName: true, shopifyStoreName: true },
            },
        },
        orderBy: { lastSyncAt: "desc" },
    })
    return rows as unknown as AdminSyncMetadata[]
}

export default async function AdminSyncHealthPage() {
    const session = await auth()
    if (!session || session.user.role !== "ADMIN") {
        redirect("/login")
    }

    const syncs = await getSyncHealth()

    return (
        <div className="flex flex-col gap-6 h-full">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
                        Sync Health
                    </h1>
                    <p className="text-sm text-slate-400 mt-1 max-w-2xl">
                        Status of Shopify syncs (products, orders, customers) across all stores.
                    </p>
                </div>
            </div>

            <div className="flex-1 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-5 overflow-auto">
                <table className="min-w-full text-sm text-left">
                    <thead className="border-b border-white/10 text-xs uppercase tracking-wide text-slate-400">
                        <tr>
                            <th className="py-2 pr-4 font-semibold">Store</th>
                            <th className="py-2 pr-4 font-semibold">Resource</th>
                            <th className="py-2 pr-4 font-semibold">Status</th>
                            <th className="py-2 pr-4 font-semibold">Records</th>
                            <th className="py-2 pr-4 font-semibold">Last Sync</th>
                            <th className="py-2 pr-4 font-semibold">Error</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {syncs.length === 0 && (
                            <tr>
                                <td
                                    colSpan={6}
                                    className="py-6 text-center text-sm text-slate-500"
                                >
                                    No sync metadata found.
                                </td>
                            </tr>
                        )}
                        {syncs.map((sync) => (
                            <tr key={sync.id} className="hover:bg-white/5">
                                <td className="py-3 pr-4 align-top">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center">
                                            <Radar className="w-4 h-4 text-cyan-200" />
                                        </div>
                                        <div>
                                            <div className="text-xs font-semibold text-white">
                                                {sync.store.businessName}
                                            </div>
                                            <div className="text-[11px] text-slate-400">
                                                {sync.store.shopifyStoreName}
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                <td className="py-3 pr-4 align-top text-xs text-slate-200">
                                    {sync.resourceType.toUpperCase()}
                                </td>
                                <td className="py-3 pr-4 align-top">
                                    <StatusPill status={sync.syncStatus} />
                                </td>
                                <td className="py-3 pr-4 align-top text-xs text-slate-200">
                                    {sync.recordCount}
                                </td>
                                <td className="py-3 pr-4 align-top text-xs text-slate-400">
                                    {new Date(sync.lastSyncAt).toLocaleString("en-US", {
                                        dateStyle: "short",
                                        timeStyle: "short",
                                    })}
                                </td>
                                <td className="py-3 pr-4 align-top text-[11px] text-rose-300">
                                    {sync.errorMessage ? (
                                        <div className="flex items-start gap-1">
                                            <Activity className="w-3 h-3 mt-0.5" />
                                            <span className="line-clamp-2">
                                                {sync.errorMessage}
                                            </span>
                                        </div>
                                    ) : (
                                        <span className="text-slate-500">—</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

function StatusPill({ status }: { status: string }) {
    const normalized = status.toUpperCase()
    let color =
        "bg-slate-800/60 text-slate-200 border-slate-500/40"

    if (normalized === "SUCCESS") {
        color = "bg-emerald-500/15 text-emerald-200 border-emerald-500/40"
    } else if (normalized === "IN_PROGRESS") {
        color = "bg-amber-500/15 text-amber-200 border-amber-500/40"
    } else if (normalized === "FAILED") {
        color = "bg-rose-500/15 text-rose-200 border-rose-500/40"
    }

    return (
        <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide border ${color}`}
        >
            {normalized}
        </span>
    )
}

