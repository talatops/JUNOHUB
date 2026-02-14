import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

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
