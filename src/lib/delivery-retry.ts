/**
 * Delivery retry logic for HeySummon help requests.
 *
 * Exponential backoff schedule:
 *   Attempt 1 → +30s
 *   Attempt 2 → +2m
 *   Attempt 3 → +10m
 *   Attempt 4 → +1h
 *   Attempt 5 → failed (no more retries)
 */

export const MAX_RETRY_ATTEMPTS = 5;

const BACKOFF_MS = [
  30_000,        // 30 seconds
  2 * 60_000,    // 2 minutes
  10 * 60_000,   // 10 minutes
  60 * 60_000,   // 1 hour
];

/**
 * Calculate the next retry time based on attempt count.
 * Returns null if max attempts exceeded.
 */
export function nextRetryAt(retryCount: number): Date | null {
  if (retryCount >= MAX_RETRY_ATTEMPTS) return null;
  const delay = BACKOFF_MS[Math.min(retryCount, BACKOFF_MS.length - 1)];
  return new Date(Date.now() + delay);
}

/**
 * Mark a request delivery as attempted (increment retry count).
 * Returns updated fields.
 */
export function buildRetryUpdate(
  currentRetryCount: number,
  success: boolean
): {
  deliveryStatus: string;
  deliveryRetryCount: number;
  deliveryLastAttemptAt: Date;
  deliveryNextRetryAt: Date | null;
  deliveredAt?: Date;
} {
  const now = new Date();
  if (success) {
    return {
      deliveryStatus: "delivered",
      deliveryRetryCount: currentRetryCount + 1,
      deliveryLastAttemptAt: now,
      deliveryNextRetryAt: null,
      deliveredAt: now,
    };
  }

  const nextCount = currentRetryCount + 1;
  const next = nextRetryAt(nextCount);

  return {
    deliveryStatus: next ? "retrying" : "failed",
    deliveryRetryCount: nextCount,
    deliveryLastAttemptAt: now,
    deliveryNextRetryAt: next,
  };
}
