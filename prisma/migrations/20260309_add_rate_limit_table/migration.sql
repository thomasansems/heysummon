-- CreateTable
CREATE TABLE IF NOT EXISTS "RateLimit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "keyId" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "resetAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "RateLimit_keyId_key" ON "RateLimit"("keyId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RateLimit_keyId_idx" ON "RateLimit"("keyId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RateLimit_resetAt_idx" ON "RateLimit"("resetAt");
