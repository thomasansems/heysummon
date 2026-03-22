-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "emailVerified" DATETIME,
    "password" TEXT,
    "name" TEXT,
    "image" TEXT,
    "role" TEXT NOT NULL DEFAULT 'provider',
    "onboardingComplete" BOOLEAN NOT NULL DEFAULT false,
    "expertise" TEXT,
    "notificationPref" TEXT NOT NULL DEFAULT 'email',
    "telegramChatId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("createdAt", "email", "emailVerified", "expertise", "id", "image", "name", "notificationPref", "onboardingComplete", "password", "role", "telegramChatId", "updatedAt") SELECT "createdAt", "email", "emailVerified", "expertise", "id", "image", "name", "notificationPref", "onboardingComplete", "password", "role", "telegramChatId", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
