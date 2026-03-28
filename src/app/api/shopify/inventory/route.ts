import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { isCacheFresh, getCachedProducts, updateProductCache } from "@/lib/cache"

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
        const cacheFresh = await isCacheFresh(store.id, "products")

        if (cacheFresh) {
            // Return cached data transformed to match Shopify format
            const cachedProducts = await getCachedProducts(store.id)
            type CachedProductRow = (typeof cachedProducts)[number]
            const transformedProducts = cachedProducts.map((product: CachedProductRow) => {
                const images = (product.images as { src: string }[]) || []
                return {
                    id: parseInt(product.shopifyProductId),
                    title: product.title,
                    vendor: product.vendor,
                    product_type: product.productType,
                    status: product.status,
                    variants: product.variants,
                    images: images,
                    image: images.length > 0 ? { src: images[0].src } : null
                }
            })
            return NextResponse.json({
                products: transformedProducts,
                cached: true,
                count: transformedProducts.length
            })
        }

        // Fetch fresh data from Shopify with timeout
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

        try {
            const response = await fetch(
                `https://${cleanDomain}/admin/api/2024-01/products.json?limit=250`,
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
                    message: "Failed to fetch products from Shopify.",
                    details: errorData
                }, { status: response.status })
            }

            const data = await response.json()

            // Update cache in background
            if (data.products) {
                await updateProductCache(store.id, data.products).catch(err => {
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
        console.error("Fetch inventory error:", { message, error, stack: error instanceof Error ? error.stack : undefined })
        return NextResponse.json({
            message: "Internal server error while fetching inventory.",
            error: message
        }, { status: 500 })
    }
}
