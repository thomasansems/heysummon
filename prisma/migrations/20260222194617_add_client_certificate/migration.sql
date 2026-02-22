/*
  Warnings:

  - You are about to drop the column `guardEncryptedPayload` on the `HelpRequest` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "ClientCertificate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "notBefore" DATETIME NOT NULL,
    "notAfter" DATETIME NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "revokedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClientCertificate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
CREATE UNIQUE INDEX "ClientCertificate_fingerprint_key" ON "ClientCertificate"("fingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "ClientCertificate_serialNumber_key" ON "ClientCertificate"("serialNumber");

-- CreateIndex
CREATE INDEX "ClientCertificate_userId_idx" ON "ClientCertificate"("userId");

-- CreateIndex
CREATE INDEX "ClientCertificate_fingerprint_idx" ON "ClientCertificate"("fingerprint");
