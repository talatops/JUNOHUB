-- AlterTable (IF NOT EXISTS: safe when column was added earlier via `db push` or manual SQL)
ALTER TABLE "CachedProduct" ADD COLUMN IF NOT EXISTS "metafields" JSONB;
