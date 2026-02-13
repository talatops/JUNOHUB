-- Migrate KnowledgeChunk embeddings from 1536 dimensions (Gemini) to 1024 dimensions (Bedrock Titan V2)
-- 
-- NOTE: This migration changes the vector dimension. Existing embeddings will need to be
-- re-embedded using the re-embedding script after this migration runs.
-- 
-- Strategy: Drop the index, change column type (will truncate/pad existing vectors),
-- then recreate the index with the new dimension.

-- Drop the existing index
DROP INDEX IF EXISTS "KnowledgeChunk_embedding_storeId_idx";

-- Change the embedding column dimension from 1536 to 1024
-- PostgreSQL will automatically truncate vectors longer than 1024 or pad shorter ones
ALTER TABLE "KnowledgeChunk"
  ALTER COLUMN "embedding" TYPE vector(1024);

-- Recreate the index with the new dimension
CREATE INDEX IF NOT EXISTS "KnowledgeChunk_embedding_storeId_idx"
  ON "KnowledgeChunk"
  USING ivfflat ("embedding" vector_cosine_ops)
  WITH (lists = 100)
  WHERE "storeId" IS NOT NULL;
