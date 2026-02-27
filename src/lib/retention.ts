import { prisma } from "./prisma";

const RETENTION_DAYS = process.env.HEYSUMMON_RETENTION_DAYS
  ? parseInt(process.env.HEYSUMMON_RETENTION_DAYS, 10)
  : null;

const INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Run a single cleanup pass.
 * Deletes expired/closed HelpRequests (+ Messages via cascade) and
 * AuditLogs older than HEYSUMMON_RETENTION_DAYS.
 *
 * Does nothing if HEYSUMMON_RETENTION_DAYS is not set.
 */
export async function runCleanup(): Promise<void> {
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
  if (!RETENTION_DAYS) return;

  started = true;
  console.log(`[retention] Data retention enabled — purging records older than ${RETENTION_DAYS} days`);

  // Run immediately on startup
  runCleanup();

  // Then every 24 hours
  setInterval(runCleanup, INTERVAL_MS);
}
