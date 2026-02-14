import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return new NextResponse("Unauthorized", { status: 401 })
        }

        const { publicKey } = await req.json()

        if (!publicKey) {
            return new NextResponse("Missing publicKey", { status: 400 })
        }

        await prisma.user.update({
            where: { id: session.user.id },
            data: { chatPublicKey: publicKey }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("[CHAT_SETUP]", error)
        return new NextResponse("Internal Error", { status: 500 })
    }
}
