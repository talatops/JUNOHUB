import { cleanShopifyDomain } from "@/lib/shopify/adminPing"

/** One metafield row stored in CachedProduct.metafields JSON (category attributes + custom). */
export type CachedShopifyMetafield = {
    namespace: string
    key: string
    value: string | null
    type: string
}

type GraphQLMetaobjectRef = {
    displayName?: string | null
} | null

type GraphQLMetafieldNode = {
    namespace?: string
    key?: string
    value?: string | null
    type?: string
    reference?: GraphQLMetaobjectRef
    references?: {
        nodes?: GraphQLMetaobjectRef[]
    } | null
}

type GraphQLProductNode = {
    legacyResourceId?: string | number | null
    metafields?: {
        nodes?: Array<GraphQLMetafieldNode | null> | null
    } | null
} | null

type GraphQLResponse = {
    data?: { nodes?: GraphQLProductNode[] | null }
    errors?: Array<{ message?: string }>
}

const GRAPHQL_API_VERSION = "2024-10"
/** Keep batches small to stay under GraphQL cost limits (many metafields per product). */
const PRODUCT_IDS_PER_REQUEST = 35
/** Max entries per list.metaobject_reference (taxonomy lists are usually small). */
const METAFIELD_REFERENCES_FIRST = 50

function displayNameFromRef(ref: GraphQLMetaobjectRef): string | undefined {
    if (!ref || typeof ref !== "object") return undefined
    const d = ref.displayName
    if (typeof d !== "string") return undefined
    const t = d.trim()
    return t.length > 0 ? t : undefined
}

/**
 * Shopify stores metaobject metafields as GID(s) in `value`. Replace with human-readable
 * labels from GraphQL `reference` / `references` when present.
 */
function resolvedMetafieldValue(n: GraphQLMetafieldNode, raw: string | null, type: string): string | null {
    if (raw === null) return null

    if (type === "metaobject_reference") {
        const label = displayNameFromRef(n.reference ?? null)
        return label ?? raw
    }

    if (type === "list.metaobject_reference") {
        const refNodes = n.references?.nodes
        if (!Array.isArray(refNodes) || refNodes.length === 0) return raw
        const labels = refNodes.map((r) => displayNameFromRef(r)).filter((x): x is string => Boolean(x))
        if (labels.length === 0) return raw
        return JSON.stringify(labels)
    }

    return raw
}

function toRows(metafields: NonNullable<GraphQLProductNode>["metafields"]): CachedShopifyMetafield[] {
    const nodes = metafields?.nodes
    if (!Array.isArray(nodes)) return []
    const out: CachedShopifyMetafield[] = []
    for (const n of nodes) {
        if (!n || typeof n.namespace !== "string" || typeof n.key !== "string") continue
        const type = typeof n.type === "string" ? n.type : "unknown"
        const raw = n.value ?? null
        out.push({
            namespace: n.namespace,
            key: n.key,
            value: resolvedMetafieldValue(n, raw, type),
            type,
        })
    }
    return out
}

/**
 * Fetches product metafields via Admin GraphQL (`nodes` query).
 * Covers category / taxonomy metafields (often `shopify.*` keys) shown in Shopify admin.
 */
export async function fetchProductMetafieldsMap(
    shopifyDomain: string,
    accessToken: string,
    productNumericIds: number[],
): Promise<Map<string, CachedShopifyMetafield[]>> {
    const result = new Map<string, CachedShopifyMetafield[]>()
    const cleanDomain = cleanShopifyDomain(shopifyDomain)
    if (!cleanDomain || !accessToken || productNumericIds.length === 0) {
        return result
    }

    const url = `https://${cleanDomain}/admin/api/${GRAPHQL_API_VERSION}/graphql.json`

    for (let i = 0; i < productNumericIds.length; i += PRODUCT_IDS_PER_REQUEST) {
        const chunk = productNumericIds.slice(i, i + PRODUCT_IDS_PER_REQUEST)
        const gidList = chunk.map((id) => `"gid://shopify/Product/${id}"`).join(", ")
        const query = `
            query ProductMetafieldsChunk {
                nodes(ids: [${gidList}]) {
                    ... on Product {
                        legacyResourceId
                        metafields(first: 250) {
                            nodes {
                                namespace
                                key
                                value
                                type
                                reference {
                                    ... on Metaobject {
                                        displayName
                                    }
                                }
                                references(first: ${METAFIELD_REFERENCES_FIRST}) {
                                    nodes {
                                        ... on Metaobject {
                                            displayName
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        `

        const res = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Shopify-Access-Token": accessToken,
            },
            body: JSON.stringify({ query }),
        })

        const json = (await res.json()) as GraphQLResponse
        if (!res.ok) {
            throw new Error(`Shopify GraphQL HTTP ${res.status}`)
        }
        if (json.errors?.length) {
            throw new Error(json.errors.map((e) => e.message).filter(Boolean).join("; ") || "GraphQL error")
        }

        const nodes = json.data?.nodes
        if (!Array.isArray(nodes)) continue

        for (const node of nodes) {
            if (!node || node.legacyResourceId == null) continue
            const idStr = String(node.legacyResourceId)
            result.set(idStr, toRows(node.metafields))
        }
    }

    return result
}
