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
    CONSTRAINT "ApiKey_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ApiKey" ("createdAt", "deviceSecret", "id", "isActive", "key", "machineId", "name", "providerId", "userId") SELECT "createdAt", "deviceSecret", "id", "isActive", "key", "machineId", "name", "providerId", "userId" FROM "ApiKey";
DROP TABLE "ApiKey";
ALTER TABLE "new_ApiKey" RENAME TO "ApiKey";
CREATE UNIQUE INDEX "ApiKey_key_key" ON "ApiKey"("key");
CREATE INDEX "ApiKey_previousKeyHash_idx" ON "ApiKey"("previousKeyHash");
CREATE TABLE "new_Provider" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "timezone" TEXT,
    "quietHoursStart" TEXT,
    "quietHoursEnd" TEXT,
    "digestTime" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Provider_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Provider" ("createdAt", "digestTime", "id", "isActive", "key", "name", "quietHoursEnd", "quietHoursStart", "timezone", "userId") SELECT "createdAt", "digestTime", "id", "isActive", "key", "name", "quietHoursEnd", "quietHoursStart", "timezone", "userId" FROM "Provider";
DROP TABLE "Provider";
ALTER TABLE "new_Provider" RENAME TO "Provider";
CREATE UNIQUE INDEX "Provider_key_key" ON "Provider"("key");
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
