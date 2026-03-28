import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { isCacheFresh, getCachedCustomers, updateCustomerCache } from "@/lib/cache"

export async function GET() {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        const store = await prisma.store.findFirst({
            where: { userId: session.user.id, isActive: true }
        })

        if (!store || !store.shopifyAccessToken || !store.shopifyDomain) {
            return NextResponse.json({ message: "Shopify store not connected." }, { status: 400 })
        }

        // Clean domain to remove any whitespace or invalid characters
        const cleanDomain = store.shopifyDomain.trim().replace(/^https?:\/\//, "").replace(/\/$/, "").trim()
        
        if (!cleanDomain) {
            return NextResponse.json({ message: "Invalid Shopify domain configured." }, { status: 400 })
        }

        // Check if cache is fresh
        const cacheFresh = await isCacheFresh(store.id, "customers")

        if (cacheFresh) {
            // Return cached data transformed to match Shopify format
            const cachedCustomers = await getCachedCustomers(store.id)
            type CachedCustomerRow = (typeof cachedCustomers)[number]
            const transformedCustomers = cachedCustomers.map((customer: CachedCustomerRow) => ({
                id: parseInt(customer.shopifyCustomerId),
                email: customer.email,
                first_name: customer.firstName,
                last_name: customer.lastName,
                orders_count: customer.ordersCount,
                total_spent: customer.totalSpent,
                phone: customer.phone,
                tags: customer.tags,
                created_at: customer.shopifyCreatedAt?.toISOString() || customer.createdAt.toISOString()
            }))
            return NextResponse.json({
                customers: transformedCustomers,
                cached: true,
                count: transformedCustomers.length
            })
        }

        // Fetch customers from Shopify with timeout and limit
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

        try {
            const response = await fetch(
                `https://${cleanDomain}/admin/api/2024-01/customers.json?limit=50`,
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
                console.error("Shopify API error:", { status: response.status, error: errorData, storeId: store.id })
                return NextResponse.json({
                    message: "Failed to fetch customers from Shopify.",
                    details: errorData
                }, { status: response.status })
            }

            const data = await response.json()

            // Update cache in background
            if (data.customers) {
                await updateCustomerCache(store.id, data.customers).catch(err => {
                    console.error("Cache update error:", err)
                })
            }

            return NextResponse.json({ ...data, cached: false })
        } catch (fetchError: unknown) {
            clearTimeout(timeoutId)
            if (fetchError instanceof Error && fetchError.name === "AbortError") {
                return NextResponse.json({
                    message: "Request timeout. Shopify API took too long to respond.",
                    error: "TIMEOUT"
                }, { status: 504 })
            }
            throw fetchError
        }

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error"
        console.error("Fetch customers error:", { message, error })
        return NextResponse.json({
            message: "Internal server error while fetching customers.",
            error: message
        }, { status: 500 })
    }
}
