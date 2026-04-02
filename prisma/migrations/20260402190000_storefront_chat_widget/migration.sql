-- Storefront chat widget enablement + minimal message persistence (v1, plain text)

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StorefrontChatSenderType') THEN
    CREATE TYPE "StorefrontChatSenderType" AS ENUM ('CUSTOMER', 'AI');
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Store"
  ADD COLUMN IF NOT EXISTS "storefrontChatEnabled" BOOLEAN NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'StorefrontChatConversation'
  ) THEN
    CREATE TABLE "StorefrontChatConversation" (
      "id" TEXT NOT NULL,
      "storeId" TEXT NOT NULL,
      "visitorId" TEXT NOT NULL,
      "customerEmail" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "StorefrontChatConversation_pkey" PRIMARY KEY ("id")
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'StorefrontChatMessage'
  ) THEN
    CREATE TABLE "StorefrontChatMessage" (
      "id" TEXT NOT NULL,
      "conversationId" TEXT NOT NULL,
      "senderType" "StorefrontChatSenderType" NOT NULL,
      "content" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "StorefrontChatMessage_pkey" PRIMARY KEY ("id")
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StorefrontChatConversation_storeId_fkey') THEN
    ALTER TABLE "StorefrontChatConversation"
      ADD CONSTRAINT "StorefrontChatConversation_storeId_fkey"
      FOREIGN KEY ("storeId") REFERENCES "Store"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StorefrontChatMessage_conversationId_fkey') THEN
    ALTER TABLE "StorefrontChatMessage"
      ADD CONSTRAINT "StorefrontChatMessage_conversationId_fkey"
      FOREIGN KEY ("conversationId") REFERENCES "StorefrontChatConversation"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'StorefrontChatConversation_storeId_visitorId_key') THEN
    CREATE UNIQUE INDEX "StorefrontChatConversation_storeId_visitorId_key"
      ON "StorefrontChatConversation"("storeId", "visitorId");
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'StorefrontChatConversation_storeId_idx') THEN
    CREATE INDEX "StorefrontChatConversation_storeId_idx"
      ON "StorefrontChatConversation"("storeId");
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'StorefrontChatMessage_conversationId_createdAt_idx') THEN
    CREATE INDEX "StorefrontChatMessage_conversationId_createdAt_idx"
      ON "StorefrontChatMessage"("conversationId", "createdAt");
  END IF;
END $$;

