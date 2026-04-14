ALTER TABLE "CachedOrder"
  ADD COLUMN IF NOT EXISTS "trackingCompany" TEXT,
  ADD COLUMN IF NOT EXISTS "trackingUrl" TEXT;
