import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

function withCors(res: NextResponse) {
    res.headers.set("Access-Control-Allow-Origin", "*")
    res.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS")
    res.headers.set("Access-Control-Allow-Headers", "Content-Type")
    return res
}

export async function OPTIONS() {
    return withCors(new NextResponse(null, { status: 204 }))
}

/**
 * GET /api/storefront-chat/config?shop=<shop-domain>
 * Public endpoint used by the storefront widget bootstrap.
 */
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url)
        const shop = searchParams.get("shop")

        if (!shop) {
            return withCors(NextResponse.json({ message: "Missing shop" }, { status: 400 }))
        }

        const p = prisma as any
        const store = await p.store.findFirst({
            where: { shopifyDomain: shop },
            select: { id: true, storefrontChatEnabled: true }
        })

        if (!store) {
            // If we don't know the store, don't show the widget.
            return withCors(NextResponse.json({ enabled: false }, { status: 200 }))
        }

        return withCors(NextResponse.json({
            enabled: store.storefrontChatEnabled
        }))
    } catch (error) {
        console.error("[STORE_FRONT_CHAT_CONFIG]", error)
        return withCors(NextResponse.json({ message: "Internal Error" }, { status: 500 }))
    }
}

