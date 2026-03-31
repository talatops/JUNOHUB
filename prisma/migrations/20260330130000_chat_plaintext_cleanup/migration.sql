-- Remove obsolete chat key columns from User.
ALTER TABLE "User"
  DROP COLUMN IF EXISTS "chatPublicKey",
  DROP COLUMN IF EXISTS "chatPrivateKeyEncrypted";

-- Rename encrypted message payload to plain content.
ALTER TABLE "ChatMessage"
  RENAME COLUMN "encryptedContent" TO "content";

-- Remove obsolete encryption metadata columns.
ALTER TABLE "ChatMessage"
  DROP COLUMN IF EXISTS "encryptedKeyForSender",
  DROP COLUMN IF EXISTS "encryptedKeyForReceiver",
  DROP COLUMN IF EXISTS "iv";

