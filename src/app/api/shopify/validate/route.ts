import { NextResponse } from "next/server"

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { domain, accessToken } = body

        if (!domain || !accessToken) {
            return NextResponse.json({ message: "Store domain and access token are required." }, { status: 400 })
        }

        // Clean domain: remove protocol, trailing slashes, and trim whitespace
        const cleanDomain = domain.trim().replace(/^https?:\/\//, "").replace(/\/$/, "").trim()

        // Create an AbortController for timeout
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000)

        try {
            // Shopify Shop API endpoint
            const response = await fetch(`https://${cleanDomain}/admin/api/2024-01/shop.json`, {
                method: "GET",
                headers: {
                    "X-Shopify-Access-Token": accessToken,
                    "Content-Type": "application/json"
                },
                signal: controller.signal
            })

            clearTimeout(timeoutId)

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                return NextResponse.json({
                    message: "Invalid credentials. Please verify your domain and access token.",
                    details: errorData
                }, { status: response.status })
            }

            const data = await response.json()
            return NextResponse.json({
                message: "Validation successful!",
                shop: data.shop
            })

        } catch (fetchError: unknown) {
            clearTimeout(timeoutId)
            if (fetchError instanceof Error && fetchError.name === "AbortError") {
                return NextResponse.json({ message: "Connection to Shopify timed out. Please check the domain." }, { status: 408 })
            }
            throw fetchError
        }

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error"
        console.error("Shopify validation error:", error)
        return NextResponse.json({
            message: "Failed to connect to Shopify. Verify the domain is correct.",
            error: message
        }, { status: 500 })
    }
}
