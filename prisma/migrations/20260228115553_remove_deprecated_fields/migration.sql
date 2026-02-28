-- AlterTable: Remove deprecated v3 fields from HelpRequest
-- These fields have been replaced by the Message model for v4 E2E encryption

ALTER TABLE "HelpRequest" DROP COLUMN "messages";
ALTER TABLE "HelpRequest" DROP COLUMN "question";
ALTER TABLE "HelpRequest" DROP COLUMN "response";
ALTER TABLE "HelpRequest" DROP COLUMN "consumerPublicKey";
ALTER TABLE "HelpRequest" DROP COLUMN "serverPublicKey";
ALTER TABLE "HelpRequest" DROP COLUMN "serverPrivateKey";
ALTER TABLE "HelpRequest" DROP COLUMN "respondedAt";
