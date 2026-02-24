-- Rename Provider → UserProfile
ALTER TABLE "Provider" RENAME TO "UserProfile";

-- Drop and recreate the unique index with new table name
DROP INDEX IF EXISTS "Provider_key_key";
CREATE UNIQUE INDEX "UserProfile_key_key" ON "UserProfile"("key");

-- CreateTable: ChannelProvider
CREATE TABLE "ChannelProvider" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "config" TEXT NOT NULL DEFAULT '{}',
    "pairingCode" TEXT,
    "pairingExpires" DATETIME,
    "paired" BOOLEAN NOT NULL DEFAULT false,
    "lastHeartbeat" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'disconnected',
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ChannelProvider_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "UserProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ChannelProvider_pairingCode_key" ON "ChannelProvider"("pairingCode");
CREATE INDEX "ChannelProvider_profileId_idx" ON "ChannelProvider"("profileId");
CREATE INDEX "ChannelProvider_type_idx" ON "ChannelProvider"("type");

-- Add channel fields to HelpRequest
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
    "channelProviderId" TEXT,
    "consumerChatId" TEXT,
    "consumerName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "HelpRequest_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "ApiKey" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "HelpRequest_expertId_fkey" FOREIGN KEY ("expertId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "HelpRequest_channelProviderId_fkey" FOREIGN KEY ("channelProviderId") REFERENCES "ChannelProvider" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_HelpRequest" ("apiKeyId", "closedAt", "consumerEncryptPubKey", "consumerPublicKey", "consumerSignPubKey", "contentFlags", "createdAt", "expertId", "expiresAt", "guardVerified", "id", "messages", "providerEncryptPubKey", "providerSignPubKey", "question", "refCode", "respondedAt", "response", "serverPrivateKey", "serverPublicKey", "status", "updatedAt") SELECT "apiKeyId", "closedAt", "consumerEncryptPubKey", "consumerPublicKey", "consumerSignPubKey", "contentFlags", "createdAt", "expertId", "expiresAt", "guardVerified", "id", "messages", "providerEncryptPubKey", "providerSignPubKey", "question", "refCode", "respondedAt", "response", "serverPrivateKey", "serverPublicKey", "status", "updatedAt" FROM "HelpRequest";
DROP TABLE "HelpRequest";
ALTER TABLE "new_HelpRequest" RENAME TO "HelpRequest";
CREATE UNIQUE INDEX "HelpRequest_refCode_key" ON "HelpRequest"("refCode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- Redefine ApiKey to point to UserProfile
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ApiKey" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "name" TEXT,
    "userId" TEXT NOT NULL,
    "providerId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deviceSecret" TEXT,
    "machineId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ApiKey_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "UserProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ApiKey" ("createdAt", "deviceSecret", "id", "isActive", "key", "machineId", "name", "providerId", "userId") SELECT "createdAt", "deviceSecret", "id", "isActive", "key", "machineId", "name", "providerId", "userId" FROM "ApiKey";
DROP TABLE "ApiKey";
ALTER TABLE "new_ApiKey" RENAME TO "ApiKey";
CREATE UNIQUE INDEX "ApiKey_key_key" ON "ApiKey"("key");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateTable: ClientCertificate (was in schema but not yet migrated)
CREATE TABLE IF NOT EXISTS "ClientCertificate" (
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
CREATE UNIQUE INDEX IF NOT EXISTS "ClientCertificate_fingerprint_key" ON "ClientCertificate"("fingerprint");
CREATE UNIQUE INDEX IF NOT EXISTS "ClientCertificate_serialNumber_key" ON "ClientCertificate"("serialNumber");
CREATE INDEX IF NOT EXISTS "ClientCertificate_userId_idx" ON "ClientCertificate"("userId");
CREATE INDEX IF NOT EXISTS "ClientCertificate_fingerprint_idx" ON "ClientCertificate"("fingerprint");
