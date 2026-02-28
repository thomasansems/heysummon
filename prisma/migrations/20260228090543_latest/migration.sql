/*
  Warnings:

  - You are about to drop the `ProviderChannel` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropIndex
DROP INDEX "ProviderChannel_providerId_type_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "ProviderChannel";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "IpEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "apiKeyId" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "firstSeen" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeen" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IpEvent_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "ApiKey" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
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
    "scope" TEXT NOT NULL DEFAULT 'full',
    "previousKeyHash" TEXT,
    "previousKeyExpiresAt" DATETIME,
    "allowedIps" TEXT,
    "rateLimitPerMinute" INTEGER NOT NULL DEFAULT 100,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ApiKey_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "UserProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ApiKey" ("createdAt", "deviceSecret", "id", "isActive", "key", "machineId", "name", "providerId", "userId") SELECT "createdAt", "deviceSecret", "id", "isActive", "key", "machineId", "name", "providerId", "userId" FROM "ApiKey";
DROP TABLE "ApiKey";
ALTER TABLE "new_ApiKey" RENAME TO "ApiKey";
CREATE UNIQUE INDEX "ApiKey_key_key" ON "ApiKey"("key");
CREATE INDEX "ApiKey_previousKeyHash_idx" ON "ApiKey"("previousKeyHash");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "IpEvent_apiKeyId_idx" ON "IpEvent"("apiKeyId");

-- CreateIndex
CREATE UNIQUE INDEX "IpEvent_apiKeyId_ip_key" ON "IpEvent"("apiKeyId", "ip");
