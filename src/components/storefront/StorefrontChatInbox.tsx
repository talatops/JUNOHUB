import { prisma } from "@/lib/prisma"
import { storeSelectDashboardStorefrontInbox } from "@/lib/prisma/storeSelects"
import { auth } from "@/auth.vendor"
import { redirect } from "next/navigation"
import StorefrontChatInboxClient, {
    type SerializedConversationCard,
    type SerializedStorefrontMessage,
} from "@/components/storefront/StorefrontChatInboxClient"

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

    /** Most recent messages store-wide (then grouped per conversation); avoids loading unbounded history. */
    const messages = conversationIds.length
        ? await prisma.storefrontChatMessage.findMany({
              where: { conversationId: { in: conversationIds } },
              orderBy: { createdAt: "desc" },
              take: 800,
              select: {
                  id: true,
                  conversationId: true,
                  content: true,
                  createdAt: true,
                  senderType: true,
              },
          })
        : []

    const byConversationId = new Map<string, typeof messages>()
    for (const m of messages) {
        const list = byConversationId.get(m.conversationId) ?? []
        list.push(m)
        byConversationId.set(m.conversationId, list)
    }
    for (const list of byConversationId.values()) {
        list.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    }

    const serializedCards: SerializedConversationCard[] = conversations.map((c) => {
        const thread = byConversationId.get(c.id) ?? []
        const serializedMessages: SerializedStorefrontMessage[] = thread.map((m) => ({
            id: m.id,
            conversationId: m.conversationId,
            content: m.content,
            createdAt: m.createdAt.toISOString(),
            senderType: m.senderType,
        }))
        return {
            id: c.id,
            visitorId: c.visitorId,
            customerEmail: c.customerEmail,
            updatedAt: c.updatedAt.toISOString(),
            messages: serializedMessages,
        }
    })

    const cardsWithMessages = serializedCards.filter((c) => c.messages.length > 0)

    const aiCount = messages.filter((m) => m.senderType === "AI").length
    const customerCount = messages.filter((m) => m.senderType === "CUSTOMER").length

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
                    <p className="text-sm font-black text-white">
                        {cardsWithMessages.length} conversation{cardsWithMessages.length === 1 ? "" : "s"}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">{messages.length} messages</p>
                    <p className="text-[11px] text-slate-500 mt-1">
                        {customerCount} customer · {aiCount} AI
                    </p>
                </div>
            </div>

            {conversations.length === 0 ? (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-slate-300">
                    <p className="font-black">No storefront chat conversations yet.</p>
                    <p className="text-sm text-slate-400 mt-2">
                        When customers send a message from the widget, it will show here.
                    </p>
                </div>
            ) : cardsWithMessages.length === 0 ? (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-slate-300">
                    <p className="font-black">No messages yet.</p>
                    <p className="text-sm text-slate-400 mt-2">
                        Sessions without any messages are hidden. Once a customer sends a message from the
                        widget, the conversation will appear here.
                    </p>
                </div>
            ) : (
                <StorefrontChatInboxClient cards={cardsWithMessages} />
            )}
        </div>
    )
}
