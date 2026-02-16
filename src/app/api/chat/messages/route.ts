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

        const { receiverId, encryptedContent, encryptedKeyForSender, encryptedKeyForReceiver, iv } = await req.json()

        if (!receiverId || !encryptedContent || !encryptedKeyForSender || !encryptedKeyForReceiver || !iv) {
            return new NextResponse("Missing fields", { status: 400 })
        }

        const message = await prisma.chatMessage.create({
            data: {
                senderId: session.user.id,
                receiverId,
                encryptedContent,
                encryptedKeyForSender,
                encryptedKeyForReceiver,
                iv,
            }
        })

        // Send push notification to receiver
        try {
            await sendPushNotification(receiverId, {
                title: "New Encrypted Message",
                body: `${session.user.name || "A user"} sent you a secure message.`,
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
