-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_HelpRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "refCode" TEXT,
    "apiKeyId" TEXT NOT NULL,
    "expertId" TEXT NOT NULL,
    "messages" TEXT,
    "question" TEXT,
    "response" TEXT,
    "consumerPublicKey" TEXT,
    "serverPublicKey" TEXT,
    "serverPrivateKey" TEXT,
    "respondedAt" DATETIME,
    "consumerSignPubKey" TEXT,
    "consumerEncryptPubKey" TEXT,
    "expertSignPubKey" TEXT,
    "expertEncryptPubKey" TEXT,
    "questionPreview" TEXT,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "approvalDecision" TEXT,
    "contentFlags" TEXT,
    "guardVerified" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "responseRequired" BOOLEAN NOT NULL DEFAULT true,
    "acknowledgedAt" DATETIME,
    "deliveredAt" DATETIME,
    "consumerDeliveredAt" DATETIME,
    "expiresAt" DATETIME NOT NULL,
    "closedAt" DATETIME,
    "deliveryStatus" TEXT NOT NULL DEFAULT 'pending',
    "deliveryRetryCount" INTEGER NOT NULL DEFAULT 0,
    "deliveryLastAttemptAt" DATETIME,
    "deliveryNextRetryAt" DATETIME,
    "rating" INTEGER,
    "ratingFeedback" TEXT,
    "ratedAt" DATETIME,
    "responseTimeMs" INTEGER,
    "escalatedAt" DATETIME,
    "phoneCallSid" TEXT,
    "phoneCallStatus" TEXT,
    "phoneCallResponse" TEXT,
    "phoneCallAt" DATETIME,
    "notifiedExpertAt" DATETIME,
    "clientTimedOutAt" DATETIME,
    "expertChannelId" TEXT,
    "consumerChatId" TEXT,
    "consumerName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "HelpRequest_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "ApiKey" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "HelpRequest_expertId_fkey" FOREIGN KEY ("expertId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "HelpRequest_expertChannelId_fkey" FOREIGN KEY ("expertChannelId") REFERENCES "ExpertChannel" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_HelpRequest" ("apiKeyId", "approvalDecision", "clientTimedOutAt", "closedAt", "consumerChatId", "consumerDeliveredAt", "consumerEncryptPubKey", "consumerName", "consumerPublicKey", "consumerSignPubKey", "contentFlags", "createdAt", "deliveredAt", "deliveryLastAttemptAt", "deliveryNextRetryAt", "deliveryRetryCount", "deliveryStatus", "escalatedAt", "expertChannelId", "expertEncryptPubKey", "expertId", "expertSignPubKey", "expiresAt", "guardVerified", "id", "messages", "notifiedExpertAt", "phoneCallAt", "phoneCallResponse", "phoneCallSid", "phoneCallStatus", "question", "questionPreview", "ratedAt", "rating", "ratingFeedback", "refCode", "requiresApproval", "respondedAt", "response", "responseTimeMs", "serverPrivateKey", "serverPublicKey", "status", "updatedAt") SELECT "apiKeyId", "approvalDecision", "clientTimedOutAt", "closedAt", "consumerChatId", "consumerDeliveredAt", "consumerEncryptPubKey", "consumerName", "consumerPublicKey", "consumerSignPubKey", "contentFlags", "createdAt", "deliveredAt", "deliveryLastAttemptAt", "deliveryNextRetryAt", "deliveryRetryCount", "deliveryStatus", "escalatedAt", "expertChannelId", "expertEncryptPubKey", "expertId", "expertSignPubKey", "expiresAt", "guardVerified", "id", "messages", "notifiedExpertAt", "phoneCallAt", "phoneCallResponse", "phoneCallSid", "phoneCallStatus", "question", "questionPreview", "ratedAt", "rating", "ratingFeedback", "refCode", "requiresApproval", "respondedAt", "response", "responseTimeMs", "serverPrivateKey", "serverPublicKey", "status", "updatedAt" FROM "HelpRequest";
DROP TABLE "HelpRequest";
ALTER TABLE "new_HelpRequest" RENAME TO "HelpRequest";
CREATE UNIQUE INDEX "HelpRequest_refCode_key" ON "HelpRequest"("refCode");
CREATE INDEX "HelpRequest_responseRequired_status_expiresAt_idx" ON "HelpRequest"("responseRequired", "status", "expiresAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
