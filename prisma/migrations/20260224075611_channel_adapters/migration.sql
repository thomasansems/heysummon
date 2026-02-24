-- RedefineTables
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
    "digestTime" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_UserProfile" ("createdAt", "digestTime", "id", "isActive", "key", "name", "quietHoursEnd", "quietHoursStart", "timezone", "userId") SELECT "createdAt", "digestTime", "id", "isActive", "key", "name", "quietHoursEnd", "quietHoursStart", "timezone", "userId" FROM "UserProfile";
DROP TABLE "UserProfile";
ALTER TABLE "new_UserProfile" RENAME TO "UserProfile";
CREATE UNIQUE INDEX "UserProfile_key_key" ON "UserProfile"("key");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
