import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import {
    countConnectionsForPair,
    hasChatConnectionForStore,
    resolveB2bChatPair,
} from "@/lib/chat/chatThreadAccess"
import { postB2bChatMessage } from "@/lib/chat/postB2bChatMessage"
import { applyRateLimit } from "@/lib/rate-limit"
import { chatMessagePostSchema } from "@/lib/api-schemas/public"
import { validationErrorResponse } from "@/lib/api-schemas/validate"

export async function POST(req: Request) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return new NextResponse("Unauthorized", { status: 401 })
        }

        const rate = await applyRateLimit(req, "chat:messages", {
            windowMs: 60_000,
            maxRequests: 120,
        })
        if (!rate.success) {
            return NextResponse.json(
                { message: "Too many requests. Please try again later." },
                { status: 429 },
            )
        }

        const raw = await req.json().catch(() => ({}))
        const parsed = chatMessagePostSchema.safeParse(raw)
        if (!parsed.success) {
            return validationErrorResponse(parsed.error)
        }

        const { receiverId, content, kind, attachment, storeId: storeIdRaw } = parsed.data
        const normalizedKind = kind ?? "TEXT"

        const posted = await postB2bChatMessage({
            senderId: session.user.id,
            receiverId,
            storeId: storeIdRaw,
            kind: normalizedKind,
            content,
            attachment: normalizedKind === "TEXT" ? null : attachment,
            notify: true,
        })

        if (!posted.ok) {
            if (posted.reason === "invalid_pair") {
                return new NextResponse("Invalid chat participant", { status: 403 })
            }
            if (posted.reason === "store_not_connected") {
                return new NextResponse("Store not connected for this chat", { status: 403 })
            }
            return new NextResponse("Attachment store does not match chat store", { status: 400 })
        }

        const message = await prisma.chatMessage.findUniqueOrThrow({
            where: { id: posted.messageId },
        })

        return NextResponse.json(message)
    } catch (error) {
        console.error("[CHAT_MESSAGES_POST]", error)
        return new NextResponse("Internal Error", { status: 500 })
    }
}

export async function GET(req: Request) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return new NextResponse("Unauthorized", { status: 401 })
        }

        const { searchParams } = new URL(req.url)
        const contactId = searchParams.get("contactId")
        const storeId = searchParams.get("storeId")

        if (!contactId) {
            return new NextResponse("Missing contactId", { status: 400 })
        }
        if (!storeId) {
            return new NextResponse("Missing storeId", { status: 400 })
        }

        const pair = await resolveB2bChatPair(session.user.id, contactId)
        if (!pair) {
            return new NextResponse("Invalid chat participant", { status: 403 })
        }

        const allowed = await hasChatConnectionForStore(
            pair.vendorUserId,
            pair.supplierUserId,
            storeId
        )
        if (!allowed) {
            return new NextResponse("Store not connected for this chat", { status: 403 })
        }

        const pairConnectionCount = await countConnectionsForPair(
            pair.vendorUserId,
            pair.supplierUserId
        )

        const userPairOr = [
            { senderId: session.user.id, receiverId: contactId },
            { senderId: contactId, receiverId: session.user.id },
        ]

        const messages =
            pairConnectionCount <= 1
                ? await prisma.chatMessage.findMany({
                      where: {
                          AND: [
                              { OR: userPairOr },
                              {
                                  OR: [{ storeId }, { storeId: null }],
                              },
                          ],
                      },
                      orderBy: { createdAt: "asc" },
                  })
                : await prisma.chatMessage.findMany({
                      where: {
                          AND: [{ OR: userPairOr }, { storeId }],
                      },
                      orderBy: { createdAt: "asc" },
                  })

        return NextResponse.json({ messages })
    } catch (error) {
        console.error("[CHAT_MESSAGES_GET]", error)
        return new NextResponse("Internal Error", { status: 500 })
    }
}
