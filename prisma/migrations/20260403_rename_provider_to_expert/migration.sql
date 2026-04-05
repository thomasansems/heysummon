-- RenameProvider -> Expert
-- Rename models (tables)
ALTER TABLE "ChannelProvider" RENAME TO "ExpertChannel";
ALTER TABLE "ProviderIntegrationConfig" RENAME TO "ExpertIntegrationConfig";
ALTER TABLE "ProviderMetrics" RENAME TO "ExpertMetrics";

-- Rename columns in ApiKey
ALTER TABLE "ApiKey" RENAME COLUMN "providerId" TO "expertId";

-- Rename columns in SetupToken
ALTER TABLE "SetupToken" RENAME COLUMN "providerName" TO "expertName";

-- Rename columns in HelpRequest
ALTER TABLE "HelpRequest" RENAME COLUMN "providerSignPubKey" TO "expertSignPubKey";
ALTER TABLE "HelpRequest" RENAME COLUMN "providerEncryptPubKey" TO "expertEncryptPubKey";
ALTER TABLE "HelpRequest" RENAME COLUMN "notifiedProviderAt" TO "notifiedExpertAt";
ALTER TABLE "HelpRequest" RENAME COLUMN "channelProviderId" TO "expertChannelId";

-- Rename columns in ExpertMetrics (already renamed table)
ALTER TABLE "ExpertMetrics" RENAME COLUMN "providerId" TO "expertId";

-- Rename columns in MissedRequest
ALTER TABLE "MissedRequest" RENAME COLUMN "providerId" TO "expertId";

-- ── Data value migrations ──────────────────────────────────────────

-- 1. ExpertChannel.config: rename JSON key providerChatId -> expertChatId
UPDATE "ExpertChannel" SET "config" = REPLACE("config", '"providerChatId"', '"expertChatId"')
  WHERE "config" LIKE '%providerChatId%';

-- 2. Message.from: provider -> expert
UPDATE "Message" SET "from" = 'expert' WHERE "from" = 'provider';

-- 3. ApiKey.key: hs_prov_ prefix -> hs_exp_
UPDATE "ApiKey" SET "key" = REPLACE("key", 'hs_prov_', 'hs_exp_')
  WHERE "key" LIKE 'hs_prov_%';

-- 4. User.role: provider -> expert
UPDATE "User" SET "role" = 'expert' WHERE "role" = 'provider';
