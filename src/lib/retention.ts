import { prisma } from "./prisma";
import { getGdprSettings } from "./gdpr";

const ENV_RETENTION_DAYS = process.env.HEYSUMMON_RETENTION_DAYS
  ? parseInt(process.env.HEYSUMMON_RETENTION_DAYS, 10)
  : null;

const INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Resolve the effective retention days.
 * GDPR settings override env var when GDPR is enabled.
 */
async function getEffectiveRetentionDays(): Promise<number | null> {
  const gdpr = await getGdprSettings();
  if (gdpr.enabled) {
    return gdpr.retentionDays;
  }
  return ENV_RETENTION_DAYS;
}

/**
 * Run a single cleanup pass.
 * Deletes expired/closed HelpRequests (+ Messages via cascade) and
 * AuditLogs older than the configured retention period.
 *
 * Uses GDPR retention days when GDPR is enabled, otherwise HEYSUMMON_RETENTION_DAYS.
 * Does nothing if neither is configured.
 */
export async function runCleanup(): Promise<void> {
  const RETENTION_DAYS = await getEffectiveRetentionDays();
  if (!RETENTION_DAYS || isNaN(RETENTION_DAYS) || RETENTION_DAYS <= 0) {
    return;
  }

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

  try {
    // Delete expired/closed requests older than cutoff
    // Messages are deleted automatically via onDelete: Cascade
    const { count: requestsDeleted } = await prisma.helpRequest.deleteMany({
      where: {
        status: { in: ["expired", "closed"] },
        updatedAt: { lt: cutoff },
      },
    });

    // Delete audit logs older than cutoff
    const { count: logsDeleted } = await prisma.auditLog.deleteMany({
      where: {
        createdAt: { lt: cutoff },
      },
    });

    if (requestsDeleted > 0 || logsDeleted > 0) {
      console.log(
        `[retention] Cleanup complete — removed ${requestsDeleted} request(s), ${logsDeleted} audit log(s) older than ${RETENTION_DAYS} days`
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.error(`[retention] Cleanup failed: ${message}`);
  }
}

/**
 * Start the background retention job.
 * Runs immediately on startup, then every 24 hours.
 * Safe to call multiple times — only registers once.
 */
let started = false;

export function startRetentionJob(): void {
  if (started) return;

  started = true;

  // Check if retention is configured (env var or GDPR) and start if so
  getEffectiveRetentionDays().then((days) => {
    if (!days) {
      console.log("[retention] No retention policy configured (set HEYSUMMON_RETENTION_DAYS or enable GDPR)");
      return;
    }
    console.log(`[retention] Data retention enabled — purging records older than ${days} days`);
  });

  // Run immediately on startup
  runCleanup();

  // Then every 24 hours (will re-check effective retention days each run)
  setInterval(runCleanup, INTERVAL_MS);
}
