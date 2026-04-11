import { NextResponse } from "next/server"
import { auth } from "@/auth.vendor"
import { prisma } from "@/lib/prisma"

/**
 * GET /api/stores
 * List all stores for the authenticated user
 */
export async function GET() {
    try {
        const session = await auth()

        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        const stores = await prisma.store.findMany({
            where: {
                userId: session.user.id
            },
            select: {
                id: true,
                businessName: true,
                shopifyDomain: true,
                shopifyStoreName: true,
                onboardingComplete: true,
                isActive: true,
                storefrontChatEnabled: true,
                storefrontChatName: true,
                storefrontChatTagline: true,
                storefrontChatBrandColor: true,
                storefrontChatFontFamily: true,
                storefrontChatLogoUrl: true,
                createdAt: true
            },
            orderBy: {
                createdAt: "desc"
            }
        })

        return NextResponse.json({ stores })
    } catch (error) {
        console.error("Error fetching stores:", error)
        return NextResponse.json(
            { message: "Failed to fetch stores" },
            { status: 500 }
        )
    }
}
