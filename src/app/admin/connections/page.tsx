import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { Link2 } from "lucide-react"

interface AdminConnection {
    id: string
    status: string
    createdAt: Date
    updatedAt: Date
    store: {
        businessName: string
        shopifyStoreName: string
    }
    supplier: {
        companyName: string
    }
}

async function getConnections(): Promise<AdminConnection[]> {
    const connections = await prisma.connection.findMany({
        include: {
            store: { select: { businessName: true, shopifyStoreName: true } },
            supplier: { select: { companyName: true } },
        },
        orderBy: { createdAt: "desc" },
    })
    return connections as unknown as AdminConnection[]
}

export default async function AdminConnectionsPage() {
    const session = await auth()
    if (!session || session.user.role !== "ADMIN") {
        redirect("/login")
    }

    const connections = await getConnections()

    return (
        <div className="flex flex-col gap-6 h-full">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
                        Connections
                    </h1>
                    <p className="text-sm text-slate-400 mt-1 max-w-2xl">
                        Read-only view of vendor ↔ supplier connections across the platform.
                    </p>
                </div>
            </div>

            <div className="flex-1 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-5 overflow-auto">
                <table className="min-w-full text-sm text-left">
                    <thead className="border-b border-white/10 text-xs uppercase tracking-wide text-slate-400">
                        <tr>
                            <th className="py-2 pr-4 font-semibold">Vendor Store</th>
                            <th className="py-2 pr-4 font-semibold">Supplier</th>
                            <th className="py-2 pr-4 font-semibold">Status</th>
                            <th className="py-2 pr-4 font-semibold">Created</th>
                            <th className="py-2 pr-4 font-semibold">Last Updated</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {connections.length === 0 && (
                            <tr>
                                <td
                                    colSpan={5}
                                    className="py-6 text-center text-sm text-slate-500"
                                >
                                    No connections found.
                                </td>
                            </tr>
                        )}
                        {connections.map((connection) => (
                            <tr key={connection.id} className="hover:bg-white/5">
                                <td className="py-3 pr-4 align-top">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-400/30 flex items-center justify-center">
                                            <Link2 className="w-4 h-4 text-blue-200" />
                                        </div>
                                        <div>
                                            <div className="text-xs font-semibold text-white">
                                                {connection.store.businessName}
                                            </div>
                                            <div className="text-[11px] text-slate-400">
                                                {connection.store.shopifyStoreName}
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                <td className="py-3 pr-4 align-top">
                                    <div className="text-xs font-semibold text-white">
                                        {connection.supplier.companyName}
                                    </div>
                                </td>
                                <td className="py-3 pr-4 align-top">
                                    <StatusPill status={connection.status} />
                                </td>
                                <td className="py-3 pr-4 align-top text-xs text-slate-400">
                                    {new Date(connection.createdAt).toLocaleString("en-US", {
                                        dateStyle: "short",
                                        timeStyle: "short",
                                    })}
                                </td>
                                <td className="py-3 pr-4 align-top text-xs text-slate-400">
                                    {new Date(connection.updatedAt).toLocaleString("en-US", {
                                        dateStyle: "short",
                                        timeStyle: "short",
                                    })}
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

    if (normalized === "CONNECTED") {
        color = "bg-emerald-500/15 text-emerald-200 border-emerald-500/40"
    } else if (normalized === "PENDING") {
        color = "bg-amber-500/15 text-amber-200 border-amber-500/40"
    } else if (normalized === "REJECTED") {
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

