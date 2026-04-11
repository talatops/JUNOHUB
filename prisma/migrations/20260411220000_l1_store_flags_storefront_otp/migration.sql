-- AlterTable
ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "categoryMetadetailsEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "aiModules" JSONB;

-- AlterTable
ALTER TABLE "StorefrontChatConversation" ADD COLUMN IF NOT EXISTS "assertedEmail" TEXT;
ALTER TABLE "StorefrontChatConversation" ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMP(3);
ALTER TABLE "StorefrontChatConversation" ADD COLUMN IF NOT EXISTS "sessionExpiresAt" TIMESTAMP(3);
ALTER TABLE "StorefrontChatConversation" ADD COLUMN IF NOT EXISTS "boundShopifyOrderId" TEXT;
ALTER TABLE "StorefrontChatConversation" ADD COLUMN IF NOT EXISTS "otpHash" TEXT;
ALTER TABLE "StorefrontChatConversation" ADD COLUMN IF NOT EXISTS "otpExpiresAt" TIMESTAMP(3);
ALTER TABLE "StorefrontChatConversation" ADD COLUMN IF NOT EXISTS "l1State" JSONB;
