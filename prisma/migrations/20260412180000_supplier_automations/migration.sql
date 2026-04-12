-- Idempotent: safe when objects already exist (partial / db push / re-apply after resolve).

DO $$
BEGIN
  CREATE TYPE "SupplierAutomationKind" AS ENUM ('LOW_STOCK', 'ASK_SUPPLIER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "lowStockThreshold" INTEGER;

CREATE TABLE IF NOT EXISTS "LowStockAlertState" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "shopifyProductId" TEXT NOT NULL,
    "lastSeenTotalQty" INTEGER,
    "lastNotifiedBelowAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LowStockAlertState_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SupplierAutomationLog" (
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

CREATE UNIQUE INDEX IF NOT EXISTS "LowStockAlertState_storeId_shopifyProductId_key" ON "LowStockAlertState"("storeId", "shopifyProductId");

CREATE INDEX IF NOT EXISTS "LowStockAlertState_storeId_idx" ON "LowStockAlertState"("storeId");

CREATE INDEX IF NOT EXISTS "SupplierAutomationLog_storeId_kind_createdAt_idx" ON "SupplierAutomationLog"("storeId", "kind", "createdAt");

CREATE INDEX IF NOT EXISTS "SupplierAutomationLog_storeId_shopifyProductId_supplierUserId_createdAt_idx" ON "SupplierAutomationLog"("storeId", "shopifyProductId", "supplierUserId", "createdAt");

DO $$
BEGIN
  ALTER TABLE "LowStockAlertState" ADD CONSTRAINT "LowStockAlertState_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "SupplierAutomationLog" ADD CONSTRAINT "SupplierAutomationLog_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
