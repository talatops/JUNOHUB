-- Add vendor-configurable storefront chat branding fields.
ALTER TABLE "Store"
ADD COLUMN "storefrontChatName" TEXT,
ADD COLUMN "storefrontChatTagline" TEXT,
ADD COLUMN "storefrontChatBrandColor" TEXT,
ADD COLUMN "storefrontChatFontFamily" TEXT,
ADD COLUMN "storefrontChatLogoUrl" TEXT;
