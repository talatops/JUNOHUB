-- CreateEnum
CREATE TYPE "SupplierAutomationKind" AS ENUM ('LOW_STOCK', 'ASK_SUPPLIER');

-- AlterTable
ALTER TABLE "Store" ADD COLUMN "lowStockThreshold" INTEGER;

-- CreateTable
CREATE TABLE "LowStockAlertState" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "shopifyProductId" TEXT NOT NULL,
    "lastSeenTotalQty" INTEGER,
    "lastNotifiedBelowAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LowStockAlertState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierAutomationLog" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "kind" "SupplierAutomationKind" NOT NULL,
    "shopifyProductId" TEXT,
    "supplierUserId" TEXT,
    "ticketKey" TEXT,
    "messagePreview" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierAutomationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LowStockAlertState_storeId_shopifyProductId_key" ON "LowStockAlertState"("storeId", "shopifyProductId");

-- CreateIndex
CREATE INDEX "LowStockAlertState_storeId_idx" ON "LowStockAlertState"("storeId");

-- CreateIndex
CREATE INDEX "SupplierAutomationLog_storeId_kind_createdAt_idx" ON "SupplierAutomationLog"("storeId", "kind", "createdAt");

-- CreateIndex
CREATE INDEX "SupplierAutomationLog_storeId_shopifyProductId_supplierUserId_createdAt_idx" ON "SupplierAutomationLog"("storeId", "shopifyProductId", "supplierUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "LowStockAlertState" ADD CONSTRAINT "LowStockAlertState_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierAutomationLog" ADD CONSTRAINT "SupplierAutomationLog_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
