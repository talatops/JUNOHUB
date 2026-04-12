-- AlterTable
ALTER TABLE "CachedOrder" ADD COLUMN IF NOT EXISTS "holdReasonCode" TEXT,
ADD COLUMN IF NOT EXISTS "holdNote" TEXT;
