-- AlterTable
ALTER TABLE "HelpRequest" ADD COLUMN "consumerPublicKey" TEXT;
ALTER TABLE "HelpRequest" ADD COLUMN "messages" TEXT;
ALTER TABLE "HelpRequest" ADD COLUMN "question" TEXT;
ALTER TABLE "HelpRequest" ADD COLUMN "respondedAt" DATETIME;
ALTER TABLE "HelpRequest" ADD COLUMN "response" TEXT;
ALTER TABLE "HelpRequest" ADD COLUMN "serverPrivateKey" TEXT;
ALTER TABLE "HelpRequest" ADD COLUMN "serverPublicKey" TEXT;
