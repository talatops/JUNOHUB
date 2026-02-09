import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { handleApiError } from "@/lib/errors"

export async function GET(
    request: Request,
    { params }: { params: Promise<{ orderId: string }> }
) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        const { orderId } = await params

        const store = await prisma.store.findFirst({
            where: { userId: session.user.id, isActive: true }
        })

        if (!store || !store.shopifyAccessToken || !store.shopifyDomain) {
            return NextResponse.json({ message: "Shopify store not connected." }, { status: 400 })
        }

        const cleanDomain = store.shopifyDomain.trim().replace(/^https?:\/\//, "").replace(/\/$/, "").trim()

        if (!cleanDomain) {
            return NextResponse.json({ message: "Invalid Shopify domain configured." }, { status: 400 })
        }

        // Fetch order from Shopify
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 30000)

        try {
            const response = await fetch(
                `https://${cleanDomain}/admin/api/2024-01/orders/${orderId}.json`,
                {
                    method: "GET",
                    headers: {
                        "X-Shopify-Access-Token": store.shopifyAccessToken,
                        "Content-Type": "application/json"
                    },
                    signal: controller.signal
                }
            )
            clearTimeout(timeoutId)

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: "Unknown error" }))
                return NextResponse.json({
                    message: "Failed to fetch order from Shopify.",
                    details: errorData
                }, { status: response.status })
            }

            const data = await response.json()
            return NextResponse.json({ order: data.order })
        } catch (fetchError: unknown) {
            clearTimeout(timeoutId)
            if (fetchError instanceof Error && fetchError.name === "AbortError") {
                return NextResponse.json({
                    message: "Request timeout.",
                    error: "TIMEOUT"
                }, { status: 504 })
            }
            throw fetchError
        }

    } catch (error: unknown) {
        return handleApiError(error, "fetch-order")
    }
}
