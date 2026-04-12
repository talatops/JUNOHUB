-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'SHOPIFY_LOW_STOCK';

-- CreateTable
CREATE TABLE "LowStockShopifyVendorAlertState" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "shopifyProductId" TEXT NOT NULL,
    "lastSeenShopifyTotal" INTEGER,
    "lastNotifiedBelowAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LowStockShopifyVendorAlertState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LowStockShopifyVendorAlertState_storeId_shopifyProductId_key" ON "LowStockShopifyVendorAlertState"("storeId", "shopifyProductId");

-- CreateIndex
CREATE INDEX "LowStockShopifyVendorAlertState_storeId_idx" ON "LowStockShopifyVendorAlertState"("storeId");

-- AddForeignKey
ALTER TABLE "LowStockShopifyVendorAlertState" ADD CONSTRAINT "LowStockShopifyVendorAlertState_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
