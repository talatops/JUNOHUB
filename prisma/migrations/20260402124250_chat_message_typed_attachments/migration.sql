DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ChatMessageKind') THEN
    CREATE TYPE "ChatMessageKind" AS ENUM ('TEXT', 'PRODUCT', 'ORDER');
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "ChatMessage"
  ADD COLUMN IF NOT EXISTS "kind" "ChatMessageKind" NOT NULL DEFAULT 'TEXT';

ALTER TABLE "ChatMessage"
  ADD COLUMN IF NOT EXISTS "attachment" JSONB;

