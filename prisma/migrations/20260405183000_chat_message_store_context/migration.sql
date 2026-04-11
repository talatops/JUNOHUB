-- AlterTable
ALTER TABLE "ChatMessage" ADD COLUMN "storeId" TEXT;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "ChatMessage_senderId_receiverId_storeId_idx" ON "ChatMessage"("senderId", "receiverId", "storeId");
