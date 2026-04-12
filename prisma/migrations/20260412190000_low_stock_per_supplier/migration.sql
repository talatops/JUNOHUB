-- Low-stock dedupe is per supplier (supplier-reported quantity vs threshold).
DELETE FROM "LowStockAlertState";

DROP INDEX IF EXISTS "LowStockAlertState_storeId_shopifyProductId_key";

ALTER TABLE "LowStockAlertState" RENAME COLUMN "lastSeenTotalQty" TO "lastSeenSupplierQty";

ALTER TABLE "LowStockAlertState" ADD COLUMN "supplierId" TEXT NOT NULL;

ALTER TABLE "LowStockAlertState" ADD CONSTRAINT "LowStockAlertState_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "SupplierProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "LowStockAlertState_storeId_shopifyProductId_supplierId_key" ON "LowStockAlertState"("storeId", "shopifyProductId", "supplierId");

CREATE INDEX "LowStockAlertState_supplierId_idx" ON "LowStockAlertState"("supplierId");
