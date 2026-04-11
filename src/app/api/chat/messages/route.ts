import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { sendPushNotification } from "@/lib/push"
import {
    countConnectionsForPair,
    hasChatConnectionForStore,
    resolveB2bChatPair,
} from "@/lib/chat/chatThreadAccess"
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

        const pair = await resolveB2bChatPair(session.user.id, receiverId)
        if (!pair) {
            return new NextResponse("Invalid chat participant", { status: 403 })
        }

        const allowed = await hasChatConnectionForStore(
            pair.vendorUserId,
            pair.supplierUserId,
            storeIdRaw
        )
        if (!allowed) {
            return new NextResponse("Store not connected for this chat", { status: 403 })
        }

        const sessionUser = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { role: true },
        })

        if (
            sessionUser?.role === "VENDOR" &&
            (normalizedKind === "PRODUCT" || normalizedKind === "ORDER")
        ) {
            const att = attachment as { storeId?: string }
            if (!att.storeId || att.storeId !== storeIdRaw) {
                return new NextResponse("Attachment store does not match chat store", { status: 400 })
            }
        }

        const message = await prisma.chatMessage.create({
            data: {
                senderId: session.user.id,
                receiverId,
                storeId: storeIdRaw,
                kind: normalizedKind as any,
                content: content as any,
                attachment: (normalizedKind === "TEXT" ? null : (attachment as any)) as any,
            } as any,
        })

        try {
            await sendPushNotification(receiverId, {
                title: "New Message",
                body: `${session.user.name || "A user"} sent you a message.`,
                url: "/dashboard/chat",
            })
        } catch (pushError) {
            console.error("Failed to send push notification", pushError)
        }

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
