/*
  Warnings:

  - You are about to drop the column `guardEncryptedPayload` on the `HelpRequest` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "ProviderChannel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "providerId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "config" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProviderChannel_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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
    "providerSignPubKey" TEXT,
    "providerEncryptPubKey" TEXT,
    "contentFlags" TEXT,
    "guardVerified" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "expiresAt" DATETIME NOT NULL,
    "closedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "HelpRequest_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "ApiKey" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "HelpRequest_expertId_fkey" FOREIGN KEY ("expertId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_HelpRequest" ("apiKeyId", "closedAt", "consumerEncryptPubKey", "consumerPublicKey", "consumerSignPubKey", "contentFlags", "createdAt", "expertId", "expiresAt", "id", "messages", "providerEncryptPubKey", "providerSignPubKey", "question", "refCode", "respondedAt", "response", "serverPrivateKey", "serverPublicKey", "status", "updatedAt") SELECT "apiKeyId", "closedAt", "consumerEncryptPubKey", "consumerPublicKey", "consumerSignPubKey", "contentFlags", "createdAt", "expertId", "expiresAt", "id", "messages", "providerEncryptPubKey", "providerSignPubKey", "question", "refCode", "respondedAt", "response", "serverPrivateKey", "serverPublicKey", "status", "updatedAt" FROM "HelpRequest";
DROP TABLE "HelpRequest";
ALTER TABLE "new_HelpRequest" RENAME TO "HelpRequest";
CREATE UNIQUE INDEX "HelpRequest_refCode_key" ON "HelpRequest"("refCode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "ProviderChannel_providerId_type_key" ON "ProviderChannel"("providerId", "type");
