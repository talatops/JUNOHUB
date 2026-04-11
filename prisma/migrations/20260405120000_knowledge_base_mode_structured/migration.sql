-- CreateEnum
CREATE TYPE "KnowledgeBaseMode" AS ENUM ('UNSET', 'STRUCTURED', 'DOCUMENTS');

-- AlterTable
ALTER TABLE "Store" ADD COLUMN "knowledgeBaseMode" "KnowledgeBaseMode" NOT NULL DEFAULT 'UNSET';
ALTER TABLE "Store" ADD COLUMN "knowledgeTemplate" JSONB;

-- AlterEnum: add STRUCTURED to KnowledgeChunkSourceType
ALTER TYPE "KnowledgeChunkSourceType" ADD VALUE 'STRUCTURED';
