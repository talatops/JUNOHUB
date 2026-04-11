/**
 * Reusable `select` objects for `Store` and `StorefrontChatConversation`.
 *
 * Use plain `as const` (no `satisfies Prisma.StoreSelect` / no `Prisma.validator`) so this file
 * does not fight **stale** `@prisma/client` typings in the IDE. Prisma still type-checks each
 * `findMany({ select: ... })` at the call site against the **generated** client.
 *
 * After `prisma/schema.prisma` changes, run `npx prisma generate` (and restart the TS server).
 */
export const storeSelectStorefrontChatApi = {
    id: true,
    storefrontChatEnabled: true,
    businessName: true,
    aiModules: true,
    categoryMetadetailsEnabled: true,
    sharedFieldAnswers: true,
} as const

export const storeSelectDashboardStorefrontInbox = {
    id: true,
    businessName: true,
    shopifyDomain: true,
    isActive: true,
    categoryMetadetailsEnabled: true,
} as const

export const storeSelectGmailL1Context = {
    businessName: true,
    email: true,
    categoryMetadetailsEnabled: true,
    aiModules: true,
    sharedFieldAnswers: true,
} as const

export const storeSelectPatchStorefrontAi = {
    storefrontChatEnabled: true,
    storefrontChatName: true,
    storefrontChatTagline: true,
    storefrontChatBrandColor: true,
    storefrontChatFontFamily: true,
    storefrontChatLogoUrl: true,
    categoryMetadetailsEnabled: true,
    aiModules: true,
    modulePolicies: true,
    sharedFieldAnswers: true,
} as const

/** Session / OTP fields for L1 storefront replies */
export const storeSelectStorefrontConversationSession = {
    id: true,
    assertedEmail: true,
    emailVerifiedAt: true,
    sessionExpiresAt: true,
    boundShopifyOrderId: true,
} as const
