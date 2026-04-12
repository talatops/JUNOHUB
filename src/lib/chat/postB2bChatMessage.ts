import { Prisma, type ChatMessageKind } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { sendPushNotification } from "@/lib/push"
import {
    hasChatConnectionForStore,
    resolveB2bChatPair,
} from "@/lib/chat/chatThreadAccess"

export type PostB2bChatMessageInput = {
    senderId: string
    receiverId: string
    storeId: string
    kind?: ChatMessageKind
    content: string
    attachment?: unknown | null
    /** When true (default), notify receiver via push like the HTTP API. */
    notify?: boolean
}

export type PostB2bChatMessageResult =
    | { ok: true; messageId: string }
    | { ok: false; reason: "invalid_pair" | "store_not_connected" | "attachment_mismatch" }

/**
 * Create a B2B chat row with the same rules as POST /api/chat/messages.
 * Used by server-side automations and juno-engine ticket flows (no browser session).
 */
export async function postB2bChatMessage(
    input: PostB2bChatMessageInput,
): Promise<PostB2bChatMessageResult> {
    const kind = input.kind ?? "TEXT"
    const content = input.content.replace(/\0/g, "").slice(0, 16_000)

    const pair = await resolveB2bChatPair(input.senderId, input.receiverId)
    if (!pair) {
        return { ok: false, reason: "invalid_pair" }
    }

    const allowed = await hasChatConnectionForStore(
        pair.vendorUserId,
        pair.supplierUserId,
        input.storeId,
    )
    if (!allowed) {
        return { ok: false, reason: "store_not_connected" }
    }

    const sessionUser = await prisma.user.findUnique({
        where: { id: input.senderId },
        select: { role: true },
    })

    if (
        sessionUser?.role === "VENDOR" &&
        (kind === "PRODUCT" || kind === "ORDER")
    ) {
        const att = input.attachment as { storeId?: string } | null | undefined
        if (!att?.storeId || att.storeId !== input.storeId) {
            return { ok: false, reason: "attachment_mismatch" }
        }
    }

    const message = await prisma.chatMessage.create({
        data: {
            senderId: input.senderId,
            receiverId: input.receiverId,
            storeId: input.storeId,
            kind,
            content,
            ...(kind === "TEXT"
                ? {}
                : {
                      attachment:
                          input.attachment !== undefined && input.attachment !== null
                              ? (input.attachment as Prisma.InputJsonValue)
                              : Prisma.JsonNull,
                  }),
        },
    })

    const shouldNotify = input.notify !== false
    if (shouldNotify) {
        try {
            const sender = await prisma.user.findUnique({
                where: { id: input.senderId },
                select: { name: true },
            })
            await sendPushNotification(input.receiverId, {
                title: "New Message",
                body: `${sender?.name || "A user"} sent you a message.`,
                url: "/dashboard/chat",
            })
        } catch {
            // non-fatal
        }
    }

    return { ok: true, messageId: message.id }
}
