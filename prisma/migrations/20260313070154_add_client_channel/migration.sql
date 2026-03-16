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
    "rateLimitPerMinute" INTEGER NOT NULL DEFAULT 150,
    "clientChannel" TEXT,
    "clientSubChannel" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ApiKey_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "UserProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ApiKey" ("allowedIps", "createdAt", "deviceSecret", "id", "isActive", "key", "machineId", "name", "previousKeyExpiresAt", "previousKeyHash", "providerId", "rateLimitPerMinute", "scope", "userId") SELECT "allowedIps", "createdAt", "deviceSecret", "id", "isActive", "key", "machineId", "name", "previousKeyExpiresAt", "previousKeyHash", "providerId", "rateLimitPerMinute", "scope", "userId" FROM "ApiKey";
DROP TABLE "ApiKey";
ALTER TABLE "new_ApiKey" RENAME TO "ApiKey";
CREATE UNIQUE INDEX "ApiKey_key_key" ON "ApiKey"("key");
CREATE INDEX "ApiKey_previousKeyHash_idx" ON "ApiKey"("previousKeyHash");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
