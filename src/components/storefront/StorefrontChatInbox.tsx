import { prisma } from "@/lib/prisma"
import { storeSelectDashboardStorefrontInbox } from "@/lib/prisma/storeSelects"
import { auth } from "@/auth.vendor"
import { redirect } from "next/navigation"
import Link from "next/link"

export default async function StorefrontChatInbox() {
    const session = await auth()

    if (!session?.user?.id) {
        redirect("/login")
    }

    const stores = await prisma.store.findMany({
        where: { userId: session.user.id, onboardingComplete: true },
        select: storeSelectDashboardStorefrontInbox,
    })

    const store = stores.find((s) => s.isActive) ?? stores[0]

    if (!store) {
        redirect("/onboarding")
    }

    const conversations = await prisma.storefrontChatConversation.findMany({
        where: { storeId: store.id },
        orderBy: { updatedAt: "desc" },
        take: 25,
        select: { id: true, visitorId: true, customerEmail: true, updatedAt: true },
    })

    const conversationIds = conversations.map((c) => c.id)

    const messages = await prisma.storefrontChatMessage.findMany({
        where: conversationIds.length ? { conversationId: { in: conversationIds } } : undefined,
        orderBy: { createdAt: "desc" },
        take: 200,
        select: {
            id: true,
            content: true,
            createdAt: true,
            senderType: true,
            conversation: {
                select: {
                    visitorId: true,
                    customerEmail: true,
                },
            },
        },
    })

    const sorted = [...messages].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    const aiCount = sorted.filter((m) => m.senderType === "AI").length
    const customerCount = sorted.filter((m) => m.senderType === "CUSTOMER").length

    return (
        <div className="flex flex-col gap-4 p-1">
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <h1 className="text-xl font-black text-white">Storefront Chat Inbox</h1>
                    <p className="text-sm text-slate-400 mt-1 truncate">
                        {store.businessName} · {store.shopifyDomain}
                    </p>
                </div>
                <div className="shrink-0 text-right">
                    <p className="text-sm font-black text-white">{conversations.length} visitors</p>
                    <p className="text-xs text-slate-500 mt-1">{sorted.length} messages</p>
                    <p className="text-[11px] text-slate-500 mt-1">
                        {customerCount} customer · {aiCount} AI
                    </p>
                </div>
            </div>

            <p className="text-sm text-slate-400">
                L1 AI modules and catalog metafields:{" "}
                <Link
                    href="/dashboard/juno-engine/modules"
                    className="font-semibold text-indigo-400 hover:underline"
                >
                    JUNO Engine → Modules
                </Link>
                .
            </p>

            {sorted.length === 0 ? (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-slate-300">
                    <p className="font-black">No storefront chat messages yet.</p>
                    <p className="text-sm text-slate-400 mt-2">
                        When customers send a message from the widget, it will show here.
                    </p>
                </div>
            ) : (
                <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                    <div className="p-4 border-b border-white/10 flex items-center justify-between">
                        <p className="text-sm font-black text-white">Recent activity</p>
                        <p className="text-xs text-slate-400">Read-only</p>
                    </div>
                    <div className="max-h-[70vh] overflow-y-auto p-4 space-y-3">
                        {sorted.map((m) => (
                            <div key={m.id} className="flex flex-col gap-2">
                                <div className="flex items-center justify-between gap-4">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span
                                                className={`text-[10px] font-black uppercase tracking-widest rounded-full px-2 py-1 border ${
                                                    m.senderType === "AI"
                                                        ? "text-indigo-300 border-indigo-400/30 bg-indigo-500/10"
                                                        : "text-emerald-300 border-emerald-400/30 bg-emerald-500/10"
                                                }`}
                                            >
                                                {m.senderType === "CUSTOMER" ? "CUSTOMER" : "AI"}
                                            </span>
                                            <p className="text-xs font-black uppercase tracking-widest text-slate-400 truncate">
                                                {m.conversation?.visitorId || "visitor"}
                                            </p>
                                        </div>
                                        {m.conversation?.customerEmail ? (
                                            <p className="text-[11px] text-slate-500 truncate">
                                                {m.conversation.customerEmail}
                                            </p>
                                        ) : null}
                                    </div>
                                    <p className="text-[11px] text-slate-500 shrink-0">
                                        {new Date(m.createdAt).toLocaleString()}
                                    </p>
                                </div>
                                <div className="whitespace-pre-wrap text-sm text-white/90 bg-black/20 border border-white/10 rounded-2xl px-4 py-3">
                                    {m.content}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
