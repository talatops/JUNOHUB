-- Add structured metadata fields to EmailLog for ticket context traceability.
ALTER TABLE "EmailLog"
ADD COLUMN "metadata" JSONB,
ADD COLUMN "storefrontConversationId" TEXT;

CREATE INDEX "EmailLog_storeId_storefrontConversationId_sentAt_idx"
ON "EmailLog"("storeId", "storefrontConversationId", "sentAt");

-- Add explicit source->target product links for strict upsell eligibility.
CREATE TABLE "UpsellProductLink" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "sourceShopifyProductId" TEXT NOT NULL,
    "targetShopifyProductId" TEXT NOT NULL,
    "targetStoreId" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UpsellProductLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UpsellProductLink_storeId_sourceShopifyProductId_targetShopif_key"
ON "UpsellProductLink"("storeId", "sourceShopifyProductId", "targetShopifyProductId");

CREATE INDEX "UpsellProductLink_storeId_sourceShopifyProductId_isActive_idx"
ON "UpsellProductLink"("storeId", "sourceShopifyProductId", "isActive");

CREATE INDEX "UpsellProductLink_storeId_targetShopifyProductId_isActive_idx"
ON "UpsellProductLink"("storeId", "targetShopifyProductId", "isActive");

ALTER TABLE "UpsellProductLink"
ADD CONSTRAINT "UpsellProductLink_storeId_fkey"
FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UpsellProductLink"
ADD CONSTRAINT "UpsellProductLink_targetStoreId_fkey"
FOREIGN KEY ("targetStoreId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;
