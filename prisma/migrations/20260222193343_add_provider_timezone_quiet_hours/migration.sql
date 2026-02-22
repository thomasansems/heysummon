/*
  Warnings:

  - You are about to drop the column `guardEncryptedPayload` on the `HelpRequest` table. All the data in the column will be lost.

*/
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
CREATE TABLE "new_Provider" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "quietHoursStart" TEXT,
    "quietHoursEnd" TEXT,
    "digestTime" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Provider_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Provider" ("createdAt", "id", "isActive", "key", "name", "userId") SELECT "createdAt", "id", "isActive", "key", "name", "userId" FROM "Provider";
DROP TABLE "Provider";
ALTER TABLE "new_Provider" RENAME TO "Provider";
CREATE UNIQUE INDEX "Provider_key_key" ON "Provider"("key");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
