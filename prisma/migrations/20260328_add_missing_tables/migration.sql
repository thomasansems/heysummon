-- Add missing columns to UserProfile
-- Required by 20260330_summon_context_per_client which copies these columns
ALTER TABLE "UserProfile" ADD COLUMN "phoneFirst" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "UserProfile" ADD COLUMN "phoneFirstIntegrationId" TEXT;
ALTER TABLE "UserProfile" ADD COLUMN "phoneFirstTimeout" INTEGER NOT NULL DEFAULT 30;

-- Add notifiedProviderAt to HelpRequest
-- Renamed to notifiedExpertAt in 20260403_rename_provider_to_expert
ALTER TABLE "HelpRequest" ADD COLUMN "notifiedProviderAt" DATETIME;

-- CreateTable: Integration
CREATE TABLE "Integration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "config" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "Integration_type_key" ON "Integration"("type");
CREATE INDEX "Integration_category_idx" ON "Integration"("category");

-- CreateTable: ProviderIntegrationConfig
-- Renamed to ExpertIntegrationConfig in 20260403_rename_provider_to_expert
CREATE TABLE "ProviderIntegrationConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "config" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProviderIntegrationConfig_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "UserProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProviderIntegrationConfig_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ProviderIntegrationConfig_profileId_integrationId_key" ON "ProviderIntegrationConfig"("profileId", "integrationId");
CREATE INDEX "ProviderIntegrationConfig_profileId_idx" ON "ProviderIntegrationConfig"("profileId");
CREATE INDEX "ProviderIntegrationConfig_integrationId_idx" ON "ProviderIntegrationConfig"("integrationId");

-- CreateTable: ProviderMetrics
-- Column "providerId" renamed to "expertId" and table renamed to "ExpertMetrics" in 20260403
CREATE TABLE "ProviderMetrics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "providerId" TEXT NOT NULL,
    "avgRating" REAL,
    "avgResponseTimeMs" REAL,
    "totalResponded" INTEGER NOT NULL DEFAULT 0,
    "totalExpired" INTEGER NOT NULL DEFAULT 0,
    "reliability" REAL,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "ProviderMetrics_providerId_key" ON "ProviderMetrics"("providerId");
CREATE INDEX "ProviderMetrics_providerId_idx" ON "ProviderMetrics"("providerId");

-- CreateTable: SetupToken
-- Column "providerName" renamed to "expertName" in 20260403_rename_provider_to_expert
CREATE TABLE "SetupToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "apiKeyId" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "subChannel" TEXT,
    "providerName" TEXT,
    "summonContext" TEXT,
    "timeout" INTEGER NOT NULL DEFAULT 900,
    "pollInterval" INTEGER NOT NULL DEFAULT 3,
    "globalInstall" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SetupToken_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "ApiKey" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "SetupToken_token_key" ON "SetupToken"("token");
CREATE INDEX "SetupToken_token_idx" ON "SetupToken"("token");
CREATE INDEX "SetupToken_apiKeyId_idx" ON "SetupToken"("apiKeyId");

-- CreateTable: MissedRequest
-- Column "providerId" renamed to "expertId" in 20260403_rename_provider_to_expert
CREATE TABLE "MissedRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "apiKeyId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "nextAvailableAt" DATETIME,
    "questionPreview" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MissedRequest_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "ApiKey" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MissedRequest_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "UserProfile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "MissedRequest_apiKeyId_idx" ON "MissedRequest"("apiKeyId");
CREATE INDEX "MissedRequest_providerId_idx" ON "MissedRequest"("providerId");
CREATE INDEX "MissedRequest_createdAt_idx" ON "MissedRequest"("createdAt");

-- CreateTable: GdprSettings
CREATE TABLE "GdprSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "anonymizeIps" BOOLEAN NOT NULL DEFAULT true,
    "retentionDays" INTEGER NOT NULL DEFAULT 90,
    "requireConsent" BOOLEAN NOT NULL DEFAULT true,
    "allowDataExport" BOOLEAN NOT NULL DEFAULT true,
    "allowDataDeletion" BOOLEAN NOT NULL DEFAULT true,
    "privacyPolicyUrl" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable: UserConsent
CREATE TABLE "UserConsent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "consentType" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL DEFAULT false,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "grantedAt" DATETIME,
    "revokedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserConsent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "UserConsent_userId_consentType_key" ON "UserConsent"("userId", "consentType");
CREATE INDEX "UserConsent_userId_idx" ON "UserConsent"("userId");

-- CreateTable: DataRequest
CREATE TABLE "DataRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "result" TEXT,
    "processedAt" DATETIME,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DataRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "DataRequest_userId_idx" ON "DataRequest"("userId");
CREATE INDEX "DataRequest_status_idx" ON "DataRequest"("status");
