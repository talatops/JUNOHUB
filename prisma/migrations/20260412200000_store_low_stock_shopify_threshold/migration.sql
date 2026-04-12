-- Optional second threshold for Shopify on-hand vs supplier-reported low-stock automation.
ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "lowStockShopifyThreshold" INTEGER;
