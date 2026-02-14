import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { Shuffle } from "lucide-react"

interface AdminProductSync {
    id: string
    status: string
    createdAt: Date
    acceptedAt: Date | null
    rejectedAt: Date | null
    shopifyProductId: string
    shopifyProductTitle: string
    store: {
        businessName: string
        shopifyStoreName: string
    }
    supplier: {
        companyName: string
    }
}

async function getProductSyncs(): Promise<AdminProductSync[]> {
    const syncs = await prisma.productSync.findMany({
        include: {
            store: { select: { businessName: true, shopifyStoreName: true } },
            supplier: { select: { companyName: true } },
        },
        orderBy: { createdAt: "desc" },
    })
    return syncs as unknown as AdminProductSync[]
}

export default async function AdminProductSyncsPage() {
    const session = await auth()
    if (!session || session.user.role !== "ADMIN") {
        redirect("/login")
    }

    const syncs = await getProductSyncs()

    return (
        <div className="flex flex-col gap-6 h-full">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
                        Product Syncs
                    </h1>
                    <p className="text-sm text-slate-400 mt-1 max-w-2xl">
                        All vendor → supplier product sync requests, fully read-only.
                    </p>
                </div>
            </div>

            <div className="flex-1 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-5 overflow-auto">
                <table className="min-w-full text-sm text-left">
                    <thead className="border-b border-white/10 text-xs uppercase tracking-wide text-slate-400">
                        <tr>
                            <th className="py-2 pr-4 font-semibold">Product</th>
                            <th className="py-2 pr-4 font-semibold">Vendor Store</th>
                            <th className="py-2 pr-4 font-semibold">Supplier</th>
                            <th className="py-2 pr-4 font-semibold">Status</th>
                            <th className="py-2 pr-4 font-semibold">Requested</th>
                            <th className="py-2 pr-4 font-semibold">Resolved At</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {syncs.length === 0 && (
                            <tr>
                                <td
                                    colSpan={6}
                                    className="py-6 text-center text-sm text-slate-500"
                                >
                                    No product syncs found.
                                </td>
                            </tr>
                        )}
                        {syncs.map((sync) => (
                            <tr key={sync.id} className="hover:bg-white/5">
                                <td className="py-3 pr-4 align-top">
                                    <div className="flex items-start gap-2">
                                        <div className="w-8 h-8 rounded-full bg-purple-500/20 border border-purple-400/30 flex items-center justify-center mt-0.5">
                                            <Shuffle className="w-4 h-4 text-purple-200" />
                                        </div>
                                        <div>
                                            <div className="text-xs font-semibold text-white line-clamp-1">
                                                {sync.shopifyProductTitle}
                                            </div>
                                            <div className="text-[11px] text-slate-400">
                                                #{sync.shopifyProductId}
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                <td className="py-3 pr-4 align-top">
                                    <div className="text-xs font-semibold text-white">
                                        {sync.store.businessName}
                                    </div>
                                    <div className="text-[11px] text-slate-400">
                                        {sync.store.shopifyStoreName}
                                    </div>
                                </td>
                                <td className="py-3 pr-4 align-top">
                                    <div className="text-xs font-semibold text-white">
                                        {sync.supplier.companyName}
                                    </div>
                                </td>
                                <td className="py-3 pr-4 align-top">
                                    <StatusPill status={sync.status} />
                                </td>
                                <td className="py-3 pr-4 align-top text-xs text-slate-400">
                                    {new Date(sync.createdAt).toLocaleString("en-US", {
                                        dateStyle: "short",
                                        timeStyle: "short",
                                    })}
                                </td>
                                <td className="py-3 pr-4 align-top text-xs text-slate-400">
                                    {sync.acceptedAt || sync.rejectedAt
                                        ? new Date(sync.acceptedAt || sync.rejectedAt!).toLocaleString("en-US", {
                                              dateStyle: "short",
                                              timeStyle: "short",
                                          })
                                        : "—"}
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

    if (normalized === "ACCEPTED") {
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

