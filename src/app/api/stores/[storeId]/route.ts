import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

/**
 * DELETE /api/stores/[storeId]
 * Delete a store for the authenticated user
 */
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ storeId: string }> }
) {
    try {
        const session = await auth()

        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        const { storeId } = await params

        if (!storeId) {
            return NextResponse.json({ message: "Store ID is required" }, { status: 400 })
        }

        // Verify the store belongs to the user
        const store = await prisma.store.findFirst({
            where: {
                id: storeId,
                userId: session.user.id
            }
        })

        if (!store) {
            return NextResponse.json({ message: "Store not found" }, { status: 404 })
        }

        // Check if this is the only store
        const storeCount = await prisma.store.count({
            where: { userId: session.user.id }
        })

        if (storeCount === 1) {
            return NextResponse.json({
                message: "Cannot delete your only store. Please add another store first."
            }, { status: 400 })
        }

        // If deleting the active store, switch to another store first
        if (store.isActive) {
            const otherStore = await prisma.store.findFirst({
                where: {
                    userId: session.user.id,
                    id: { not: storeId }
                },
                orderBy: {
                    createdAt: "desc"
                }
            })

            if (otherStore) {
                // Switch to another store
                await prisma.store.updateMany({
                    where: {
                        userId: session.user.id
                    },
                    data: {
                        isActive: false
                    }
                })

                await prisma.store.update({
                    where: { id: otherStore.id },
                    data: { isActive: true }
                })

                await prisma.user.update({
                    where: { id: session.user.id },
                    data: { activeStoreId: otherStore.id }
                })
            }
        }

        // Delete the store (cascade will handle related data)
        await prisma.store.delete({
            where: { id: storeId }
        })

        return NextResponse.json({
            success: true,
            message: "Store deleted successfully"
        })
    } catch (error) {
        console.error("Error deleting store:", error)
        return NextResponse.json(
            { message: "Failed to delete store" },
            { status: 500 }
        )
    }
}

/**
 * PATCH /api/stores/[storeId]
 * Update per-store configuration (vendor only).
 */
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ storeId: string }> }
) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        const { storeId } = await params
        if (!storeId) {
            return NextResponse.json({ message: "Store ID is required" }, { status: 400 })
        }

        const { storefrontChatEnabled } = await request.json().catch(() => ({}))
        if (typeof storefrontChatEnabled !== "boolean") {
            return NextResponse.json({ message: "Invalid storefrontChatEnabled" }, { status: 400 })
        }

        // Verify store belongs to the user
        const store = await prisma.store.findFirst({
            where: {
                id: storeId,
                userId: session.user.id
            }
        })

        if (!store) {
            return NextResponse.json({ message: "Store not found" }, { status: 404 })
        }

        await prisma.store.update({
            where: { id: storeId },
            data: { storefrontChatEnabled } as any
        })

        // Best-effort: keep a Shopify ScriptTag in sync with the checkbox.
        // Even if ScriptTag operations fail (missing scopes), the widget still
        // won’t render because /api/storefront-chat/config returns the flag.
        try {
            const appBaseUrl = (
                process.env.NEXT_PUBLIC_APP_URL ||
                process.env.AUTH_URL ||
                process.env.NEXTAUTH_URL ||
                ""
            ).trim()
            const apiVersion = "2024-01"
            const injectorBase = appBaseUrl ? appBaseUrl.replace(/\/$/, "") : ""

            const cleanDomain = (store.shopifyDomain || "")
                .trim()
                .replace(/^https?:\/\//, "")
                .replace(/\/$/, "")
                .trim()

            const accessToken = store.shopifyAccessToken

            if (injectorBase && cleanDomain && accessToken) {
                const injectorPath = `${injectorBase}/storefront-chat/widget-injector`
                // ngrok often serves an HTML interstitial to third-party script requests unless this param is present.
                const needsNgrokSkip =
                    injectorBase.includes("ngrok-free.dev") ||
                    injectorBase.includes("ngrok.app") ||
                    injectorBase.includes("ngrok.io")
                const injectorSrc = needsNgrokSkip
                    ? `${injectorPath}?ngrok-skip-browser-warning=1`
                    : injectorPath

                // Shopify's `src` filter is exact-match; we want to delete any older variants too.
                // So we list a small page and filter by prefix instead.
                const listUrl = `https://${cleanDomain}/admin/api/${apiVersion}/script_tags.json?limit=250&fields=id,src`

                const commonHeaders = {
                    "X-Shopify-Access-Token": accessToken,
                    "Content-Type": "application/json"
                }

                const listRes = await fetch(listUrl, { headers: commonHeaders })
                const listData = await listRes.json().catch(() => ({}))
                const allTags: Array<{ id: number; src?: string }> = Array.isArray(listData?.script_tags)
                    ? listData.script_tags
                    : []
                const existing = allTags.filter((t) => {
                    const src = typeof t?.src === "string" ? t.src : ""
                    return src === injectorSrc || src.startsWith(injectorPath)
                })

                if (storefrontChatEnabled) {
                    // Ensure exactly one matching tag exists; clean up duplicates/old variants.
                    if (existing.length > 1) {
                        for (const tag of existing.slice(1)) {
                            if (!tag?.id) continue
                            const deleteUrl = `https://${cleanDomain}/admin/api/${apiVersion}/script_tags/${tag.id}.json`
                            await fetch(deleteUrl, {
                                method: "DELETE",
                                headers: { "X-Shopify-Access-Token": accessToken }
                            }).catch(() => {})
                        }
                    }

                    // If the remaining tag isn't the exact injectorSrc (ngrok skip param), replace it.
                    const hasExact = existing.some((t) => typeof t?.src === "string" && t.src === injectorSrc)
                    if (!hasExact) {
                        // Delete old variant(s)
                        for (const tag of existing) {
                            if (!tag?.id) continue
                            const deleteUrl = `https://${cleanDomain}/admin/api/${apiVersion}/script_tags/${tag.id}.json`
                            await fetch(deleteUrl, {
                                method: "DELETE",
                                headers: { "X-Shopify-Access-Token": accessToken }
                            }).catch(() => {})
                        }

                        const createUrl = `https://${cleanDomain}/admin/api/${apiVersion}/script_tags.json`
                        const createBody = {
                            script_tag: {
                                event: "onload",
                                src: injectorSrc,
                                display_scope: "online_store",
                                cache: false
                            }
                        }

                        const createRes = await fetch(createUrl, {
                            method: "POST",
                            headers: commonHeaders,
                            body: JSON.stringify(createBody)
                        })

                        if (!createRes.ok) {
                            const errText = await createRes.text().catch(() => "")
                            console.error("[STORE_FRONT_CHAT_SCRIPTTAG_CREATE]", { storeId, status: createRes.status, errText })
                        }
                    }
                } else {
                    for (const tag of existing) {
                        if (!tag?.id) continue
                        const deleteUrl = `https://${cleanDomain}/admin/api/${apiVersion}/script_tags/${tag.id}.json`
                        const delRes = await fetch(deleteUrl, {
                            method: "DELETE",
                            headers: { "X-Shopify-Access-Token": accessToken }
                        })

                        if (!delRes.ok) {
                            const errText = await delRes.text().catch(() => "")
                            console.error("[STORE_FRONT_CHAT_SCRIPTTAG_DELETE]", { storeId, tagId: tag.id, status: delRes.status, errText })
                        }
                    }
                }
            } else {
                console.warn("[STORE_FRONT_CHAT_SCRIPTTAG_SKIP]", {
                    storeId,
                    hasInjectorBase: Boolean(appBaseUrl),
                    cleanDomain,
                    hasAccessToken: Boolean(accessToken)
                })
            }
        } catch (scriptError) {
            console.error("[STORE_FRONT_CHAT_SCRIPTTAG_ERROR]", scriptError)
        }

        return NextResponse.json({
            success: true,
            storefrontChatEnabled
        })
    } catch (error) {
        console.error("Error updating store settings:", error)
        return NextResponse.json(
            { message: "Failed to update store setting" },
            { status: 500 }
        )
    }
}
