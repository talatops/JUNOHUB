import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { isVendorPortalRole } from "@/lib/auth-roles"
import { prisma } from "@/lib/prisma"
import { getCachedProducts, isCacheFresh, updateProductCache } from "@/lib/cache"

const PER_STORE_LIMIT = 25

/**
 * GET /api/chat/attach-products
 * Returns products from all vendor stores (for chat attach). Each item includes storeId and storeName.
 * Vendor-only.
 */
export async function GET() {
    try {
        const session = await auth()
        if (!session?.user?.id || !isVendorPortalRole(session.user.role)) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        const stores = await prisma.store.findMany({
            where: { userId: session.user.id },
            select: {
                id: true,
                businessName: true,
                shopifyDomain: true,
                shopifyAccessToken: true
            }
        })

        if (stores.length === 0) {
            return NextResponse.json({ products: [] })
        }

        type StoreRow = (typeof stores)[number]

        type ProductItem = {
            id: number
            title: string
            storeId: string
            storeName: string
            imageUrl?: string | null
            description?: string | null
        }

        const extractImageUrl = (images: unknown): string | null => {
            if (!Array.isArray(images) || images.length === 0) return null
            const first = images[0] as any
            return first?.src || first?.url || null
        }

        const fetchProductsForStore = async (
            store: { id: string; businessName: string | null; shopifyDomain: string | null; shopifyAccessToken: string | null }
        ): Promise<ProductItem[]> => {
            const cleanDomain = (store.shopifyDomain || "").trim().replace(/^https?:\/\//, "").replace(/\/$/, "").trim()
            if (!cleanDomain || !store.shopifyAccessToken) return []
            const storeName = store.businessName || store.shopifyDomain || "Store"

            const cacheFresh = await isCacheFresh(store.id, "products")
            if (cacheFresh) {
                const cached = await getCachedProducts(store.id)
                type CachedProductRow = (typeof cached)[number]
                return cached.slice(0, PER_STORE_LIMIT).map((product: CachedProductRow) => ({
                    id: parseInt(product.shopifyProductId),
                    title: product.title || "Product",
                    storeId: store.id,
                    storeName,
                    imageUrl: extractImageUrl(product.images),
                    description: null
                }))
            }

            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), 15000)
            try {
                const response = await fetch(
                    `https://${cleanDomain}/admin/api/2024-01/products.json?limit=${PER_STORE_LIMIT}`,
                    {
                        method: "GET",
                        headers: {
                            "X-Shopify-Access-Token": store.shopifyAccessToken!,
                            "Content-Type": "application/json"
                        },
                        signal: controller.signal
                    }
                )
                clearTimeout(timeoutId)
                if (!response.ok) return []
                const data = await response.json()
                if (data.products?.length) {
                    await updateProductCache(store.id, data.products).catch(() => {})
                }
                return (data.products || []).map((p: any) => ({
                    id: p.id,
                    title: p.title || "Product",
                    storeId: store.id,
                    storeName,
                    imageUrl: p.images?.[0]?.src || p.images?.[0]?.url || null,
                    description: p.body_html || p.description || null
                }))
            } catch {
                return []
            }
        }

        const results = await Promise.allSettled(
            stores.map((s: StoreRow) => fetchProductsForStore(s))
        )
        const allProducts: ProductItem[] = results.flatMap((r: PromiseSettledResult<ProductItem[]>) =>
            r.status === "fulfilled" ? r.value : []
        )
        return NextResponse.json({ products: allProducts.slice(0, 50) })
    } catch (error) {
        console.error("Chat attach products error:", error)
        return NextResponse.json({ message: "Failed to load products", products: [] }, { status: 500 })
    }
}
