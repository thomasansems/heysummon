-- Add delivery retry tracking fields to HelpRequest
ALTER TABLE "HelpRequest" ADD COLUMN "deliveryStatus" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "HelpRequest" ADD COLUMN "deliveryRetryCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "HelpRequest" ADD COLUMN "deliveryLastAttemptAt" DATETIME;
ALTER TABLE "HelpRequest" ADD COLUMN "deliveryNextRetryAt" DATETIME;

-- Create index for polling pending retries
CREATE INDEX "HelpRequest_deliveryNextRetryAt_idx" ON "HelpRequest"("deliveryNextRetryAt");
