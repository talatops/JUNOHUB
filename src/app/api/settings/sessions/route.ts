import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { cookies } from "next/headers"

export async function GET() {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        // Get current session token from cookies
        const cookieStore = await cookies()
        const sessionToken = cookieStore.get("authjs.session-token")?.value || 
                            cookieStore.get("__Secure-authjs.session-token")?.value

        // Fetch all sessions for the user
        const userSessions = await prisma.session.findMany({
            where: { userId: session.user.id },
            orderBy: { expires: "desc" }
        })

        // Transform sessions to include additional info
        const sessions = userSessions.map((s) => ({
            id: s.id,
            sessionToken: s.sessionToken,
            expires: s.expires.toISOString(),
            isCurrent: s.sessionToken === sessionToken
        }))

        return NextResponse.json({ sessions })
    } catch (error) {
        console.error("Fetch sessions error:", error)
        return NextResponse.json(
            { message: "Internal server error" },
            { status: 500 }
        )
    }
}
