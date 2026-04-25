-- Add `probe` boolean to HelpRequest. Existing rows backfill to false.
-- Probe rows are synthetic round-trip verification rows created by the
-- install script's POST /api/v1/setup/verify-roundtrip call. They are
-- filtered out of every dashboard / events / search list query via
-- src/lib/help-request-scope.ts.
ALTER TABLE "HelpRequest" ADD COLUMN "probe" BOOLEAN NOT NULL DEFAULT false;
