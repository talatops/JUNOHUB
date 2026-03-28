-- CreateTable
CREATE TABLE "GmailInboundAutoReply" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "gmailMessageId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GmailInboundAutoReply_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GmailInboundAutoReply_userId_gmailMessageId_key" ON "GmailInboundAutoReply"("userId", "gmailMessageId");

-- CreateIndex
CREATE INDEX "GmailInboundAutoReply_storeId_createdAt_idx" ON "GmailInboundAutoReply"("storeId", "createdAt");

-- AddForeignKey
ALTER TABLE "GmailInboundAutoReply" ADD CONSTRAINT "GmailInboundAutoReply_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmailInboundAutoReply" ADD CONSTRAINT "GmailInboundAutoReply_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
