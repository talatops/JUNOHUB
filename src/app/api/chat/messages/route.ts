import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { sendPushNotification } from "@/lib/push"

export async function POST(req: Request) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return new NextResponse("Unauthorized", { status: 401 })
        }

        const { receiverId, content, kind, attachment } = await req.json()

        if (!receiverId || typeof receiverId !== "string") {
            return new NextResponse("Missing fields", { status: 400 })
        }

        const CHAT_KINDS = ["TEXT", "PRODUCT", "ORDER"] as const
        const normalizedKind = typeof kind === "string" && (CHAT_KINDS as readonly string[]).includes(kind) ? kind : "TEXT"

        if (normalizedKind === "TEXT") {
            if (content != null && typeof content !== "string") {
                return new NextResponse("Invalid content", { status: 400 })
            }
        } else {
            if (!attachment || typeof attachment !== "object") {
                return new NextResponse("Missing attachment for typed message", { status: 400 })
            }
        }

        const message = await prisma.chatMessage.create({
            data: {
                senderId: session.user.id,
                receiverId,
                kind: normalizedKind as any,
                content: (typeof content === "string" ? content : "") as any,
                attachment: (normalizedKind === "TEXT" ? null : (attachment as any)) as any,
            } as any
        })

        // Send push notification to receiver
        try {
            await sendPushNotification(receiverId, {
                title: "New Message",
                body: `${session.user.name || "A user"} sent you a message.`,
                url: "/dashboard/chat" // Correct to your chat dashboard path
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

        if (!contactId) {
            return new NextResponse("Missing contactId", { status: 400 })
        }

        const messages = await prisma.chatMessage.findMany({
            where: {
                OR: [
                    { senderId: session.user.id, receiverId: contactId },
                    { senderId: contactId, receiverId: session.user.id }
                ]
            },
            orderBy: {
                createdAt: "asc"
            }
        })

        return NextResponse.json({ messages })
    } catch (error) {
        console.error("[CHAT_MESSAGES_GET]", error)
        return new NextResponse("Internal Error", { status: 500 })
    }
}
