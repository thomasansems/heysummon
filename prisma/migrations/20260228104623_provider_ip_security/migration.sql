-- AlterTable
ALTER TABLE "UserProfile" ADD COLUMN "deviceSecret" TEXT;
ALTER TABLE "UserProfile" ADD COLUMN "machineId" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_IpEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "apiKeyId" TEXT,
    "profileId" TEXT,
    "ip" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "firstSeen" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeen" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IpEvent_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "ApiKey" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "IpEvent_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "UserProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_IpEvent" ("apiKeyId", "attempts", "firstSeen", "id", "ip", "lastSeen", "status") SELECT "apiKeyId", "attempts", "firstSeen", "id", "ip", "lastSeen", "status" FROM "IpEvent";
DROP TABLE "IpEvent";
ALTER TABLE "new_IpEvent" RENAME TO "IpEvent";
CREATE INDEX "IpEvent_apiKeyId_idx" ON "IpEvent"("apiKeyId");
CREATE INDEX "IpEvent_profileId_idx" ON "IpEvent"("profileId");
CREATE UNIQUE INDEX "IpEvent_apiKeyId_ip_key" ON "IpEvent"("apiKeyId", "ip");
CREATE UNIQUE INDEX "IpEvent_profileId_ip_key" ON "IpEvent"("profileId", "ip");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
