-- AlterTable
ALTER TABLE "HelpRequest" ADD COLUMN "clientTimedOutAt" DATETIME;
ALTER TABLE "HelpRequest" ADD COLUMN "consumerDeliveredAt" DATETIME;
ALTER TABLE "HelpRequest" ADD COLUMN "escalatedAt" DATETIME;
ALTER TABLE "HelpRequest" ADD COLUMN "phoneCallAt" DATETIME;
ALTER TABLE "HelpRequest" ADD COLUMN "phoneCallResponse" TEXT;
ALTER TABLE "HelpRequest" ADD COLUMN "phoneCallSid" TEXT;
ALTER TABLE "HelpRequest" ADD COLUMN "phoneCallStatus" TEXT;
ALTER TABLE "HelpRequest" ADD COLUMN "ratedAt" DATETIME;
ALTER TABLE "HelpRequest" ADD COLUMN "rating" INTEGER;
ALTER TABLE "HelpRequest" ADD COLUMN "ratingFeedback" TEXT;
ALTER TABLE "HelpRequest" ADD COLUMN "responseTimeMs" INTEGER;

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
    "role" TEXT NOT NULL DEFAULT 'expert',
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

-- RedefineIndex
DROP INDEX "ChannelProvider_type_idx";
CREATE INDEX "ExpertChannel_type_idx" ON "ExpertChannel"("type");

-- RedefineIndex
DROP INDEX "ChannelProvider_profileId_idx";
CREATE INDEX "ExpertChannel_profileId_idx" ON "ExpertChannel"("profileId");

-- RedefineIndex
DROP INDEX "ChannelProvider_pairingCode_key";
CREATE UNIQUE INDEX "ExpertChannel_pairingCode_key" ON "ExpertChannel"("pairingCode");

-- RedefineIndex
DROP INDEX "ProviderIntegrationConfig_integrationId_idx";
CREATE INDEX "ExpertIntegrationConfig_integrationId_idx" ON "ExpertIntegrationConfig"("integrationId");

-- RedefineIndex
DROP INDEX "ProviderIntegrationConfig_profileId_idx";
CREATE INDEX "ExpertIntegrationConfig_profileId_idx" ON "ExpertIntegrationConfig"("profileId");

-- RedefineIndex
DROP INDEX "ProviderIntegrationConfig_profileId_integrationId_key";
CREATE UNIQUE INDEX "ExpertIntegrationConfig_profileId_integrationId_key" ON "ExpertIntegrationConfig"("profileId", "integrationId");

-- RedefineIndex
DROP INDEX "ProviderMetrics_providerId_idx";
CREATE INDEX "ExpertMetrics_expertId_idx" ON "ExpertMetrics"("expertId");

-- RedefineIndex
DROP INDEX "ProviderMetrics_providerId_key";
CREATE UNIQUE INDEX "ExpertMetrics_expertId_key" ON "ExpertMetrics"("expertId");

-- RedefineIndex
DROP INDEX "MissedRequest_providerId_idx";
CREATE INDEX "MissedRequest_expertId_idx" ON "MissedRequest"("expertId");
