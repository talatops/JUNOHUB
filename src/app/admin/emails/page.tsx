import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { Mail } from "lucide-react"

interface AdminEmailLog {
    id: string
    to: string
    subject: string
    bodyPreview: string | null
    isAutomated: boolean
    trigger: string | null
    status: string
    providerMessageId: string | null
    errorMessage: string | null
    sentAt: Date
    store: {
        businessName: string
        shopifyStoreName: string
    } | null
}

async function getEmails(): Promise<{ emails: AdminEmailLog[]; total: number }> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prismaAny = prisma as any
    const [emails, total] = await Promise.all([
        prismaAny.emailLog.findMany({
            include: { store: { select: { businessName: true, shopifyStoreName: true } } },
            orderBy: { sentAt: "desc" },
            take: 100,
        }),
        prismaAny.emailLog.count(),
    ])
    return { emails: emails as AdminEmailLog[], total }
}

export default async function AdminEmailsPage() {
    const session = await auth()
    if (!session || session.user.role !== "ADMIN") {
        redirect("/login")
    }

    const { emails, total } = await getEmails()
    const failedCount = emails.filter((e) => e.status === "FAILED").length
    const automatedCount = emails.filter((e) => e.isAutomated).length

    return (
        <div className="flex flex-col gap-6 h-full">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
                        Automated Emails
                    </h1>
                    <p className="text-sm text-slate-400 mt-1 max-w-2xl">
                        Read-only visibility into automated and system-triggered emails sent
                        from vendor Gmail integrations.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-5 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                            Total Logged Emails
                        </p>
                        <p className="text-3xl font-bold text-white mt-2">{total}</p>
                        <p className="text-xs text-slate-500 mt-1">
                            Across all vendors and stores
                        </p>
                    </div>
                    <div className="w-11 h-11 rounded-2xl bg-indigo-500/30 border border-indigo-400/40 flex items-center justify-center">
                        <Mail className="w-6 h-6 text-indigo-200" />
                    </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-5 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                            Automated Emails
                        </p>
                        <p className="text-3xl font-bold text-white mt-2">{automatedCount}</p>
                        <p className="text-xs text-slate-500 mt-1">
                            Marked as system-triggered
                        </p>
                    </div>
                    <div className="w-11 h-11 rounded-2xl bg-emerald-500/30 border border-emerald-400/40 flex items-center justify-center">
                        <Mail className="w-6 h-6 text-emerald-200" />
                    </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-5 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                            Failed Sends
                        </p>
                        <p className="text-3xl font-bold text-white mt-2">{failedCount}</p>
                        <p className="text-xs text-slate-500 mt-1">
                            Emails that failed to send via Gmail API
                        </p>
                    </div>
                    <div className="w-11 h-11 rounded-2xl bg-rose-500/30 border border-rose-400/40 flex items-center justify-center">
                        <Mail className="w-6 h-6 text-rose-200" />
                    </div>
                </div>
            </div>

            <div className="flex-1 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-5 overflow-auto">
                <table className="min-w-full text-sm text-left">
                    <thead className="border-b border-white/10 text-xs uppercase tracking-wide text-slate-400">
                        <tr>
                            <th className="py-2 pr-4 font-semibold">Vendor Store</th>
                            <th className="py-2 pr-4 font-semibold">Recipient</th>
                            <th className="py-2 pr-4 font-semibold">Subject</th>
                            <th className="py-2 pr-4 font-semibold">Trigger</th>
                            <th className="py-2 pr-4 font-semibold">Status</th>
                            <th className="py-2 pr-4 font-semibold">Sent At</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {emails.length === 0 && (
                            <tr>
                                <td
                                    colSpan={6}
                                    className="py-6 text-center text-sm text-slate-500"
                                >
                                    No emails logged yet.
                                </td>
                            </tr>
                        )}
                        {emails.map((email) => (
                            <tr key={email.id} className="hover:bg-white/5 align-top">
                                <td className="py-3 pr-4">
                                    {email.store ? (
                                        <div>
                                            <div className="text-xs font-semibold text-white">
                                                {email.store.businessName}
                                            </div>
                                            <div className="text-[11px] text-slate-400">
                                                {email.store.shopifyStoreName}
                                            </div>
                                        </div>
                                    ) : (
                                        <span className="text-xs text-slate-500">
                                            Unscoped / System
                                        </span>
                                    )}
                                </td>
                                <td className="py-3 pr-4 text-xs text-slate-200">
                                    {email.to}
                                </td>
                                <td className="py-3 pr-4">
                                    <div className="text-xs font-semibold text-white line-clamp-1">
                                        {email.subject}
                                    </div>
                                    {email.bodyPreview && (
                                        <div className="text-[11px] text-slate-400 line-clamp-2 mt-0.5">
                                            {email.bodyPreview}
                                        </div>
                                    )}
                                </td>
                                <td className="py-3 pr-4 text-[11px] text-slate-300">
                                    {email.isAutomated
                                        ? email.trigger || "AUTOMATED"
                                        : email.trigger || "MANUAL"}
                                </td>
                                <td className="py-3 pr-4">
                                    <StatusPill status={email.status} />
                                    {email.errorMessage && (
                                        <div className="mt-1 text-[10px] text-rose-300 line-clamp-1">
                                            {email.errorMessage}
                                        </div>
                                    )}
                                </td>
                                <td className="py-3 pr-4 text-xs text-slate-400">
                                    {new Date(email.sentAt).toLocaleString("en-US", {
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

    if (normalized === "SENT") {
        color = "bg-emerald-500/15 text-emerald-200 border-emerald-500/40"
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

