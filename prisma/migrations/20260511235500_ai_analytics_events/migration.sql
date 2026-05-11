CREATE TABLE "AiAnalyticsEvent" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "conversationId" TEXT,
    "messageId" TEXT,
    "eventType" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "productId" TEXT,
    "variantId" TEXT,
    "quantity" INTEGER,
    "amount" DOUBLE PRECISION,
    "currency" TEXT,
    "sentiment" TEXT,
    "resolutionStatus" TEXT,
    "orderId" TEXT,
    "attributionType" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiAnalyticsEvent_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "AiAnalyticsEvent"
ADD CONSTRAINT "AiAnalyticsEvent_storeId_fkey"
FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "AiAnalyticsEvent_storeId_eventType_createdAt_idx" ON "AiAnalyticsEvent"("storeId", "eventType", "createdAt");
CREATE INDEX "AiAnalyticsEvent_storeId_createdAt_idx" ON "AiAnalyticsEvent"("storeId", "createdAt");
CREATE INDEX "AiAnalyticsEvent_conversationId_idx" ON "AiAnalyticsEvent"("conversationId");
CREATE INDEX "AiAnalyticsEvent_productId_idx" ON "AiAnalyticsEvent"("productId");
CREATE INDEX "AiAnalyticsEvent_orderId_idx" ON "AiAnalyticsEvent"("orderId");
