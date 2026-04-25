/**
 * Active request monitoring background job.
 *
 * Runs on a fixed interval and performs three tasks:
 * 1. Expire stale requests (status pending/active with expiresAt in the past)
 * 2. Retry failed deliveries (deliveryStatus = "retrying" with next retry due)
 * 3. Escalate unacknowledged requests (pending for >30min with no delivery ACK)
 *
 * Follows the same setInterval singleton pattern as retention.ts.
 */

import { prisma } from "./prisma";
import { transitionRequest, StaleStateError, type RequestStatus } from "./request-lifecycle";
import { buildRetryUpdate } from "./delivery-retry";
import { logAuditEvent, AuditEventTypes } from "./audit";
import { recalculateMetrics } from "./expert-metrics";
import { nonProbe } from "./help-request-scope";

const INTERVAL_MS = parseInt(
  process.env.HEYSUMMON_MONITOR_INTERVAL_MS ?? "300000",
  10
); // Default: 5 minutes

const ESCALATION_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Job 1: Expire requests past their TTL.
 *
 * Finds all requests with status pending/active where expiresAt < now,
 * transitions them to expired via the state machine.
 */
async function expireStaleRequests(): Promise<number> {
  const now = new Date();

  const stale = await prisma.helpRequest.findMany({
    where: nonProbe({
      status: { in: ["pending", "active"] },
      expiresAt: { lt: now },
    }),
    select: { id: true, status: true, expertId: true },
    take: 100,
  });

  let expired = 0;
  for (const req of stale) {
    try {
      await transitionRequest(req.id, req.status as RequestStatus, "expired", {
        actor: "system:active-monitor",
        extra: { reason: "ttl_exceeded" },
      });
      expired++;

      // Fire-and-forget: update expert metrics
      if (req.expertId) {
        recalculateMetrics(req.expertId);
      }
    } catch (err) {
      if (!(err instanceof StaleStateError)) {
        console.error(`[active-monitor] Failed to expire ${req.id}:`, err);
      }
      // StaleStateError means another actor transitioned it — skip
    }
  }

  return expired;
}

/**
 * Job 2: Retry failed deliveries.
 *
 * Finds requests where deliveryStatus = "retrying" and the next retry time has passed.
 * Uses the existing buildRetryUpdate() function from delivery-retry.ts.
 */
async function retryDeliveries(): Promise<number> {
  const now = new Date();

  const retryable = await prisma.helpRequest.findMany({
    where: nonProbe({
      deliveryStatus: "retrying",
      deliveryNextRetryAt: { lt: now },
    }),
    select: { id: true, deliveryRetryCount: true, expertId: true, refCode: true },
    take: 50,
  });

  let retried = 0;
  for (const req of retryable) {
    try {
      // For now, mark the attempt. Actual re-notification (Telegram/webhook)
      // would go here when the notification dispatch is wired in.
      const update = buildRetryUpdate(req.deliveryRetryCount, false);

      await prisma.helpRequest.update({
        where: { id: req.id },
        data: update,
      });

      logAuditEvent({
        eventType: AuditEventTypes.DELIVERY_RETRY_ATTEMPTED,
        success: true,
        metadata: {
          requestId: req.id,
          refCode: req.refCode,
          attempt: req.deliveryRetryCount + 1,
          nextStatus: update.deliveryStatus,
        },
      });

      retried++;
    } catch (err) {
      console.error(`[active-monitor] Failed to retry delivery for ${req.id}:`, err);
    }
  }

  return retried;
}

/**
 * Job 3: Escalate unacknowledged requests.
 *
 * Finds requests that have been pending for >30 minutes with no delivery ACK
 * (deliveredAt IS NULL) and no prior escalation.
 */
async function escalateRequests(): Promise<number> {
  const threshold = new Date(Date.now() - ESCALATION_THRESHOLD_MS);

  const unacked = await prisma.helpRequest.findMany({
    where: nonProbe({
      status: "pending",
      deliveredAt: null,
      escalatedAt: null,
      createdAt: { lt: threshold },
    }),
    select: { id: true, expertId: true, refCode: true },
    take: 50,
  });

  let escalated = 0;
  for (const req of unacked) {
    try {
      await prisma.helpRequest.update({
        where: { id: req.id },
        data: { escalatedAt: new Date() },
      });

      logAuditEvent({
        eventType: AuditEventTypes.ESCALATION_TRIGGERED,
        success: true,
        metadata: {
          requestId: req.id,
          refCode: req.refCode,
          reason: "unacknowledged_30min",
        },
      });

      escalated++;
    } catch (err) {
      console.error(`[active-monitor] Failed to escalate ${req.id}:`, err);
    }
  }

  return escalated;
}

/**
 * Run a single monitoring cycle.
 */
export async function runMonitorCycle(): Promise<void> {
  try {
    const [expired, retried, escalated] = await Promise.all([
      expireStaleRequests(),
      retryDeliveries(),
      escalateRequests(),
    ]);

    if (expired > 0 || retried > 0 || escalated > 0) {
      console.log(
        `[active-monitor] Cycle complete — expired: ${expired}, retried: ${retried}, escalated: ${escalated}`
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.error(`[active-monitor] Cycle failed: ${message}`);
  }
}

/**
 * Start the active monitor background job.
 * Runs immediately on startup, then every INTERVAL_MS.
 * Safe to call multiple times — only registers once.
 */
let started = false;

export function startActiveMonitor(): void {
  if (started) return;
  started = true;

  console.log(
    `[active-monitor] Started — running every ${INTERVAL_MS / 1000}s`
  );

  // Run immediately on startup
  runMonitorCycle();

  // Then on interval
  setInterval(runMonitorCycle, INTERVAL_MS);
}
