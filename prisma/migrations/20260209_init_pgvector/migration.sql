-- Enable pgvector extension and create index for knowledge chunk embeddings

CREATE EXTENSION IF NOT EXISTS vector;

-- Adjust the embedding column on KnowledgeChunk to use a concrete vector dimension.
-- NOTE: Update 1536 to match the actual embedding size used by your Gemini model.
ALTER TABLE "KnowledgeChunk"
  ALTER COLUMN "embedding" TYPE vector(1536);

CREATE INDEX IF NOT EXISTS "KnowledgeChunk_embedding_storeId_idx"
  ON "KnowledgeChunk"
  USING ivfflat ("embedding" vector_cosine_ops)
  WITH (lists = 100)
  WHERE "storeId" IS NOT NULL;

