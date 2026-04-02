import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * GET /api/storefront-chat/config?shop=<shop-domain>
 * Public endpoint used by the storefront widget bootstrap.
 */
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url)
        const shop = searchParams.get("shop")

        if (!shop) {
            return NextResponse.json({ message: "Missing shop" }, { status: 400 })
        }

        const store = await prisma.store.findFirst({
            where: { shopifyDomain: shop },
            select: { id: true, storefrontChatEnabled: true }
        })

        if (!store) {
            // If we don't know the store, don't show the widget.
            return NextResponse.json({ enabled: false }, { status: 200 })
        }

        return NextResponse.json({
            enabled: store.storefrontChatEnabled
        })
    } catch (error) {
        console.error("[STORE_FRONT_CHAT_CONFIG]", error)
        return NextResponse.json({ message: "Internal Error" }, { status: 500 })
    }
}

