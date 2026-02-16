import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { decryptString } from "@/lib/encryption"

export async function GET() {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return new NextResponse("Unauthorized", { status: 401 })
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id }
        }) as { chatPrivateKeyEncrypted?: string | null } | null

        if (!user?.chatPrivateKeyEncrypted) {
            return NextResponse.json(
                { hasBackup: false },
                {
                    headers: {
                        "Cache-Control": "no-store"
                    }
                }
            )
        }

        const decrypted = decryptString(user.chatPrivateKeyEncrypted)
        if (!decrypted) {
            return NextResponse.json(
                { hasBackup: false },
                {
                    headers: {
                        "Cache-Control": "no-store"
                    }
                }
            )
        }

        return NextResponse.json(
            { hasBackup: true, privateKey: decrypted },
            {
                headers: {
                    "Cache-Control": "no-store"
                }
            }
        )
    } catch (error) {
        console.error("[CHAT_KEY_GET]", error)
        return new NextResponse("Internal Error", { status: 500 })
    }
}

