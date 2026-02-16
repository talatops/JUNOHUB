import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { encryptString } from "@/lib/encryption"

export async function POST(req: Request) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return new NextResponse("Unauthorized", { status: 401 })
        }

        const { publicKey, privateKey } = await req.json() as {
            publicKey?: string
            privateKey?: string
        }

        if (!publicKey) {
            return new NextResponse("Missing publicKey", { status: 400 })
        }

        let chatPrivateKeyEncrypted: string | undefined
        if (privateKey) {
            try {
                chatPrivateKeyEncrypted = encryptString(privateKey)
            } catch (err) {
                console.error("[CHAT_SETUP] Failed to encrypt private key", err)
                return new NextResponse("Failed to encrypt private key", { status: 500 })
            }
        }

        await prisma.user.update({
            where: { id: session.user.id },
            data: {
                chatPublicKey: publicKey,
                ...(chatPrivateKeyEncrypted ? { chatPrivateKeyEncrypted } : {})
            }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("[CHAT_SETUP]", error)
        return new NextResponse("Internal Error", { status: 500 })
    }
}
