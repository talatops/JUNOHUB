import type { Prisma } from "@prisma/client"
import { prisma } from "./prisma"
import { fetchProductMetafieldsMap } from "@/lib/shopify/productMetafieldsGraphql"

/** Minimal Shopify API shapes for cache updates */
interface ShopifyProductRecord {
    id: number
    title?: string
    vendor?: string
    product_type?: string
    status?: string
    variants?: unknown[]
    images?: unknown[]
}
interface ShopifyOrderRecord {
    id: number
    order_number?: number
    name?: string
    email?: string
    total_price?: string
    currency?: string
    financial_status?: string
    fulfillment_status?: string
    customer?: unknown
    line_items?: unknown[]
    note_attributes?: unknown[]
    created_at?: string
}

/** Shopify often leaves `order.email` empty but sets `customer.email`. */
function extractOrderEmail(order: ShopifyOrderRecord): string | null {
    const direct = order.email?.trim()
    if (direct) return direct
    const c = order.customer
    if (c && typeof c === "object" && c !== null && "email" in c) {
        const fromCustomer = String((c as { email?: string }).email ?? "").trim()
        if (fromCustomer) return fromCustomer
    }
    return null
}
interface ShopifyCustomerRecord {
    id: number
    email?: string
    first_name?: string
    last_name?: string
    orders_count?: number
    total_spent?: string
    phone?: string
    tags?: string
    created_at?: string
    /** Shopify REST customer `default_address` */
    default_address?: unknown
}

function defaultAddressForCustomerCache(addr: unknown): Prisma.InputJsonValue | undefined {
    if (!addr || typeof addr !== "object" || Array.isArray(addr)) return undefined
    const a = addr as Record<string, unknown>
    const payload = {
        city: typeof a.city === "string" ? a.city : null,
        country: typeof a.country === "string" ? a.country : null,
        country_name: typeof a.country_name === "string" ? a.country_name : null,
        province: typeof a.province === "string" ? a.province : null,
        address1: typeof a.address1 === "string" ? a.address1 : null,
    }
    const hasAny = Object.values(payload).some((v) => v != null && String(v).trim() !== "")
    if (!hasAny) return undefined
    return payload as Prisma.InputJsonValue
}

// Cache TTL (Time To Live) in milliseconds
const CACHE_TTL = {
    products: 60 * 60 * 1000, // 1 hour
    orders: 5 * 60 * 1000,     // 5 minutes
    customers: 30 * 60 * 1000  // 30 minutes
}

type ResourceType = "products" | "orders" | "customers"

/**
 * Check if cache is fresh for a given resource type
 */
export async function isCacheFresh(storeId: string, resourceType: ResourceType): Promise<boolean> {
    const metadata = await prisma.syncMetadata.findUnique({
        where: {
            storeId_resourceType: {
                storeId,
                resourceType
            }
        }
    })

    if (!metadata) return false

    const ttl = CACHE_TTL[resourceType]
    const age = Date.now() - metadata.lastSyncAt.getTime()

    return age < ttl && metadata.syncStatus === "success"
}

/**
 * Get cached products for a store
 */
export async function getCachedProducts(storeId: string) {
    return await prisma.cachedProduct.findMany({
        where: { storeId },
        orderBy: { updatedAt: "desc" }
    })
}

/**
 * Get cached orders for a store
 */
export async function getCachedOrders(storeId: string) {
    return await prisma.cachedOrder.findMany({
        where: { storeId },
        orderBy: { shopifyCreatedAt: "desc" }
    })
}

/**
 * Get cached customers for a store
 */
export async function getCachedCustomers(storeId: string) {
    return await prisma.cachedCustomer.findMany({
        where: { storeId },
        orderBy: { ordersCount: "desc" }
    })
}

/**
 * Update product cache
 */
export async function updateProductCache(storeId: string, products: ShopifyProductRecord[]) {
    try {
        const store = await prisma.store.findUnique({
            where: { id: storeId },
            select: { shopifyDomain: true, shopifyAccessToken: true },
        })

        const metafieldsByProductId = new Map<string, Prisma.InputJsonValue>()
        if (store?.shopifyDomain && store?.shopifyAccessToken && products.length > 0) {
            try {
                const ids = products.map((p) => p.id)
                const map = await fetchProductMetafieldsMap(
                    store.shopifyDomain,
                    store.shopifyAccessToken,
                    ids,
                )
                for (const [pid, rows] of map) {
                    metafieldsByProductId.set(pid, rows as Prisma.InputJsonValue)
                }
            } catch (e) {
                console.error("[updateProductCache] Metafields GraphQL fetch failed:", e)
            }
        }

        // Delete existing cached products
        await prisma.cachedProduct.deleteMany({
            where: { storeId }
        })

        // Insert new products
        const cachedProducts = products.map((product) => ({
            shopifyProductId: product.id.toString(),
            storeId,
            title: product.title ?? "",
            vendor: product.vendor || null,
            productType: product.product_type || null,
            status: product.status || null,
            variants: (product.variants || []) as import("@prisma/client").Prisma.InputJsonValue,
            images: (product.images || []) as import("@prisma/client").Prisma.InputJsonValue,
            metafields: (metafieldsByProductId.get(product.id.toString()) ??
                []) as Prisma.InputJsonValue,
        }))

        await prisma.cachedProduct.createMany({
            data: cachedProducts
        })

        // Update sync metadata
        await prisma.syncMetadata.upsert({
            where: {
                storeId_resourceType: {
                    storeId,
                    resourceType: "products"
                }
            },
            create: {
                storeId,
                resourceType: "products",
                lastSyncAt: new Date(),
                syncStatus: "success",
                recordCount: products.length
            },
            update: {
                lastSyncAt: new Date(),
                syncStatus: "success",
                recordCount: products.length,
                errorMessage: null
            }
        })

        return true
    } catch (error) {
        console.error("Error updating product cache:", error)

        // Update sync metadata with error
        await prisma.syncMetadata.upsert({
            where: {
                storeId_resourceType: {
                    storeId,
                    resourceType: "products"
                }
            },
            create: {
                storeId,
                resourceType: "products",
                syncStatus: "failed",
                errorMessage: error instanceof Error ? error.message : "Unknown error"
            },
            update: {
                syncStatus: "failed",
                errorMessage: error instanceof Error ? error.message : "Unknown error"
            }
        })

        return false
    }
}

/**
 * Update order cache
 */
export async function updateOrderCache(storeId: string, orders: ShopifyOrderRecord[]) {
    try {
        const orderIds = orders.map((order) => order.id.toString())
        const pendingRows = await prisma.$queryRaw<Array<{ shopifyOrderId: string }>>`
            SELECT "shopifyOrderId"
            FROM "CachedOrder"
            WHERE "storeId" = ${storeId}
              AND "pendingVendorSync" = true
              AND "shopifyOrderId" = ANY(${orderIds}::text[])
        `
        const pendingIds = new Set(pendingRows.map((r) => r.shopifyOrderId))
        const existingRows = await prisma.cachedOrder.findMany({
            where: { storeId, shopifyOrderId: { in: orderIds } },
            select: {
                shopifyOrderId: true,
                fulfillmentStatus: true,
                holdReasonCode: true,
            },
        })
        const existingById = new Map(
            existingRows.map((r) => [
                r.shopifyOrderId,
                {
                    fulfillmentStatus: r.fulfillmentStatus,
                    holdReasonCode: r.holdReasonCode,
                },
            ]),
        )

        // Use upsert for each order to handle duplicates gracefully
        // This ensures webhooks can update orders concurrently without conflicts
        const upsertPromises = orders.map((order) =>
            prisma.cachedOrder.upsert({
                where: {
                    shopifyOrderId_storeId: {
                        shopifyOrderId: order.id.toString(),
                        storeId
                    }
                },
                create: {
                    shopifyOrderId: order.id.toString(),
                    storeId,
                    orderNumber: order.order_number?.toString() || order.name || "",
                    email: extractOrderEmail(order),
                    totalPrice: order.total_price || "0",
                    currency: order.currency || null,
                    financialStatus: order.financial_status || null,
                    fulfillmentStatus: order.fulfillment_status || null,
                    lineItems: (order.line_items || []) as Prisma.InputJsonValue,
                    noteAttributes: (order.note_attributes || []) as Prisma.InputJsonValue,
                    customer: (order.customer ?? undefined) as Prisma.InputJsonValue | undefined,
                    shopifyCreatedAt: order.created_at ? new Date(order.created_at) : null
                } as Prisma.CachedOrderUncheckedCreateInput,
                update: {
                    orderNumber: order.order_number?.toString() || order.name || "",
                    email: extractOrderEmail(order),
                    totalPrice: order.total_price || "0",
                    currency: order.currency || null,
                    financialStatus: order.financial_status || null,
                    fulfillmentStatus:
                        pendingIds.has(order.id.toString()) ||
                        (existingById.get(order.id.toString())?.fulfillmentStatus === "ON_HOLD" &&
                            !!existingById.get(order.id.toString())?.holdReasonCode)
                            ? existingById.get(order.id.toString())?.fulfillmentStatus || null
                            : order.fulfillment_status || null,
                    lineItems: (order.line_items || []) as Prisma.InputJsonValue,
                    noteAttributes: (order.note_attributes || []) as Prisma.InputJsonValue,
                    customer: (order.customer ?? undefined) as Prisma.InputJsonValue | undefined,
                    shopifyCreatedAt: order.created_at ? new Date(order.created_at) : null,
                    lastSyncedAt: new Date()
                } as Prisma.CachedOrderUncheckedUpdateInput
            })
        )

        // Execute all upserts in parallel (Prisma handles batching internally)
        await Promise.all(upsertPromises)

        // Update sync metadata
        await prisma.syncMetadata.upsert({
            where: {
                storeId_resourceType: {
                    storeId,
                    resourceType: "orders"
                }
            },
            create: {
                storeId,
                resourceType: "orders",
                lastSyncAt: new Date(),
                syncStatus: "success",
                recordCount: orders.length
            },
            update: {
                lastSyncAt: new Date(),
                syncStatus: "success",
                recordCount: orders.length,
                errorMessage: null
            }
        })

        return true
    } catch (error) {
        console.error("Error updating order cache:", error)

        await prisma.syncMetadata.upsert({
            where: {
                storeId_resourceType: {
                    storeId,
                    resourceType: "orders"
                }
            },
            create: {
                storeId,
                resourceType: "orders",
                syncStatus: "failed",
                errorMessage: error instanceof Error ? error.message : "Unknown error"
            },
            update: {
                syncStatus: "failed",
                errorMessage: error instanceof Error ? error.message : "Unknown error"
            }
        })

        return false
    }
}

/**
 * Update customer cache
 */
export async function updateCustomerCache(storeId: string, customers: ShopifyCustomerRecord[]) {
    try {
        // Delete existing cached customers
        await prisma.cachedCustomer.deleteMany({
            where: { storeId }
        })

        // Insert new customers
        const cachedCustomers = customers.map((customer) => ({
            shopifyCustomerId: customer.id.toString(),
            storeId,
            email: customer.email || null,
            firstName: customer.first_name || null,
            lastName: customer.last_name || null,
            ordersCount: customer.orders_count || 0,
            totalSpent: customer.total_spent || "0",
            phone: customer.phone || null,
            tags: customer.tags || null,
            shopifyCreatedAt: customer.created_at ? new Date(customer.created_at) : null,
            defaultAddress: defaultAddressForCustomerCache(customer.default_address),
        }))

        await prisma.cachedCustomer.createMany({
            data: cachedCustomers
        })

        // Update sync metadata
        await prisma.syncMetadata.upsert({
            where: {
                storeId_resourceType: {
                    storeId,
                    resourceType: "customers"
                }
            },
            create: {
                storeId,
                resourceType: "customers",
                lastSyncAt: new Date(),
                syncStatus: "success",
                recordCount: customers.length
            },
            update: {
                lastSyncAt: new Date(),
                syncStatus: "success",
                recordCount: customers.length,
                errorMessage: null
            }
        })

        return true
    } catch (error) {
        console.error("Error updating customer cache:", error)

        await prisma.syncMetadata.upsert({
            where: {
                storeId_resourceType: {
                    storeId,
                    resourceType: "customers"
                }
            },
            create: {
                storeId,
                resourceType: "customers",
                syncStatus: "failed",
                errorMessage: error instanceof Error ? error.message : "Unknown error"
            },
            update: {
                syncStatus: "failed",
                errorMessage: error instanceof Error ? error.message : "Unknown error"
            }
        })

        return false
    }
}

/**
 * Update a single product in cache (for webhook updates)
 */
export async function updateSingleProduct(storeId: string, product: ShopifyProductRecord) {
    const store = await prisma.store.findUnique({
        where: { id: storeId },
        select: { shopifyDomain: true, shopifyAccessToken: true },
    })

    let metafieldsPatch: Prisma.InputJsonValue | undefined
    if (store?.shopifyDomain && store?.shopifyAccessToken) {
        try {
            const map = await fetchProductMetafieldsMap(
                store.shopifyDomain,
                store.shopifyAccessToken,
                [product.id],
            )
            const rows = map.get(product.id.toString())
            if (rows !== undefined) {
                metafieldsPatch = rows as Prisma.InputJsonValue
            }
        } catch (e) {
            console.error("[updateSingleProduct] Metafields fetch failed:", e)
        }
    }

    await prisma.cachedProduct.upsert({
        where: {
            shopifyProductId_storeId: {
                shopifyProductId: product.id.toString(),
                storeId
            }
        },
        create: {
            shopifyProductId: product.id.toString(),
            storeId,
            title: product.title ?? "",
            vendor: product.vendor || null,
            productType: product.product_type || null,
            status: product.status || null,
            variants: (product.variants || []) as Prisma.InputJsonValue,
            images: (product.images || []) as Prisma.InputJsonValue,
            metafields: (metafieldsPatch ?? []) as Prisma.InputJsonValue,
            lastSyncedAt: new Date()
        },
        update: {
            title: product.title ?? "",
            vendor: product.vendor || null,
            productType: product.product_type || null,
            status: product.status || null,
            variants: (product.variants || []) as Prisma.InputJsonValue,
            images: (product.images || []) as Prisma.InputJsonValue,
            ...(metafieldsPatch !== undefined ? { metafields: metafieldsPatch } : {}),
            lastSyncedAt: new Date()
        }
    })
}

/**
 * Update a single order in cache (for webhook updates)
 */
export async function updateSingleOrder(storeId: string, order: ShopifyOrderRecord) {
    const pendingRows = await prisma.$queryRaw<
        Array<{
            pendingVendorSync: boolean
            fulfillmentStatus: string | null
            holdReasonCode: string | null
        }>
    >`
        SELECT "pendingVendorSync", "fulfillmentStatus", "holdReasonCode"
        FROM "CachedOrder"
        WHERE "storeId" = ${storeId} AND "shopifyOrderId" = ${order.id.toString()}
        LIMIT 1
    `
    const shouldPreserve = pendingRows[0]?.pendingVendorSync === true
    const hasSupplierHold =
        pendingRows[0]?.fulfillmentStatus === "ON_HOLD" && !!pendingRows[0]?.holdReasonCode
    const preservedStatus = pendingRows[0]?.fulfillmentStatus ?? null

    await prisma.cachedOrder.upsert({
        where: {
            shopifyOrderId_storeId: {
                shopifyOrderId: order.id.toString(),
                storeId
            }
        },
        create: {
            shopifyOrderId: order.id.toString(),
            storeId,
            orderNumber: order.order_number?.toString() || order.name || "",
            email: extractOrderEmail(order),
            totalPrice: order.total_price || "0",
            currency: order.currency || null,
            financialStatus: order.financial_status || null,
            fulfillmentStatus:
                shouldPreserve || hasSupplierHold ? preservedStatus : order.fulfillment_status || null,
            lineItems: (order.line_items || []) as Prisma.InputJsonValue,
            noteAttributes: (order.note_attributes || []) as Prisma.InputJsonValue,
            customer: (order.customer ?? undefined) as Prisma.InputJsonValue | undefined,
            shopifyCreatedAt: order.created_at ? new Date(order.created_at) : null,
            lastSyncedAt: new Date()
        } as Prisma.CachedOrderUncheckedCreateInput,
        update: {
            orderNumber: order.order_number?.toString() || order.name || "",
            email: extractOrderEmail(order),
            totalPrice: order.total_price || "0",
            currency: order.currency || null,
            financialStatus: order.financial_status || null,
            fulfillmentStatus:
                shouldPreserve || hasSupplierHold ? preservedStatus : order.fulfillment_status || null,
            lineItems: (order.line_items || []) as Prisma.InputJsonValue,
            noteAttributes: (order.note_attributes || []) as Prisma.InputJsonValue,
            customer: (order.customer ?? undefined) as Prisma.InputJsonValue | undefined,
            shopifyCreatedAt: order.created_at ? new Date(order.created_at) : null,
            lastSyncedAt: new Date()
        } as Prisma.CachedOrderUncheckedUpdateInput
    })
}
