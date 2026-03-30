-- Per-client summon context model
-- Removes provider-level summonContext, adds recentSummonContexts (JSON array)
-- SetupToken.summonContext remains (stores per-client context at link-creation time)

-- RedefineTables (SQLite requires table recreation to drop a column)
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_UserProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "timezone" TEXT,
    "quietHoursStart" TEXT,
    "quietHoursEnd" TEXT,
    "availableDays" TEXT,
    "digestTime" TEXT,
    "deviceSecret" TEXT,
    "machineId" TEXT,
    "tagline" TEXT,
    "taglineEnabled" BOOLEAN NOT NULL DEFAULT false,
    "recentSummonContexts" TEXT,
    "phoneFirst" BOOLEAN NOT NULL DEFAULT false,
    "phoneFirstIntegrationId" TEXT,
    "phoneFirstTimeout" INTEGER NOT NULL DEFAULT 30,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_UserProfile" ("id", "name", "key", "userId", "isActive", "timezone", "quietHoursStart", "quietHoursEnd", "availableDays", "digestTime", "deviceSecret", "machineId", "tagline", "taglineEnabled", "phoneFirst", "phoneFirstIntegrationId", "phoneFirstTimeout", "createdAt")
SELECT "id", "name", "key", "userId", "isActive", "timezone", "quietHoursStart", "quietHoursEnd", "availableDays", "digestTime", "deviceSecret", "machineId", "tagline", "taglineEnabled", "phoneFirst", "phoneFirstIntegrationId", "phoneFirstTimeout", "createdAt" FROM "UserProfile";
DROP TABLE "UserProfile";
ALTER TABLE "new_UserProfile" RENAME TO "UserProfile";
CREATE UNIQUE INDEX "UserProfile_key_key" ON "UserProfile"("key");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
