-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SetupToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "apiKeyId" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "subChannel" TEXT,
    "expertName" TEXT,
    "summonContext" TEXT,
    "timeout" INTEGER NOT NULL DEFAULT 900,
    "pollInterval" INTEGER NOT NULL DEFAULT 3,
    "timeoutFallback" TEXT NOT NULL DEFAULT 'proceed_cautiously',
    "globalInstall" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SetupToken_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "ApiKey" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_SetupToken" ("apiKeyId", "baseUrl", "channel", "createdAt", "expertName", "expiresAt", "globalInstall", "id", "pollInterval", "subChannel", "summonContext", "timeout", "token") SELECT "apiKeyId", "baseUrl", "channel", "createdAt", "expertName", "expiresAt", "globalInstall", "id", "pollInterval", "subChannel", "summonContext", "timeout", "token" FROM "SetupToken";
DROP TABLE "SetupToken";
ALTER TABLE "new_SetupToken" RENAME TO "SetupToken";
CREATE UNIQUE INDEX "SetupToken_token_key" ON "SetupToken"("token");
CREATE INDEX "SetupToken_token_idx" ON "SetupToken"("token");
CREATE INDEX "SetupToken_apiKeyId_idx" ON "SetupToken"("apiKeyId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
