import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  nextRetryAt,
  buildRetryUpdate,
  MAX_RETRY_ATTEMPTS,
} from "@/lib/delivery-retry";

describe("delivery-retry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("nextRetryAt", () => {
    it("returns +30s delay for retry count 0", () => {
      const result = nextRetryAt(0);
      expect(result).not.toBeNull();
      expect(result!.getTime() - Date.now()).toBe(30_000);
    });

    it("returns +2m delay for retry count 1", () => {
      const result = nextRetryAt(1);
      expect(result).not.toBeNull();
      expect(result!.getTime() - Date.now()).toBe(2 * 60_000);
    });

    it("returns +10m delay for retry count 2", () => {
      const result = nextRetryAt(2);
      expect(result).not.toBeNull();
      expect(result!.getTime() - Date.now()).toBe(10 * 60_000);
    });

    it("returns +1h delay for retry count 3", () => {
      const result = nextRetryAt(3);
      expect(result).not.toBeNull();
      expect(result!.getTime() - Date.now()).toBe(60 * 60_000);
    });

    it("clamps to last backoff value for retry count 4", () => {
      const result = nextRetryAt(4);
      expect(result).not.toBeNull();
      expect(result!.getTime() - Date.now()).toBe(60 * 60_000);
    });

    it("returns null when retry count >= MAX_RETRY_ATTEMPTS", () => {
      expect(nextRetryAt(MAX_RETRY_ATTEMPTS)).toBeNull();
      expect(nextRetryAt(MAX_RETRY_ATTEMPTS + 1)).toBeNull();
      expect(nextRetryAt(100)).toBeNull();
    });
  });

  describe("buildRetryUpdate", () => {
    it("returns 'delivered' status on success", () => {
      const result = buildRetryUpdate(0, true);

      expect(result.deliveryStatus).toBe("delivered");
      expect(result.deliveryRetryCount).toBe(1);
      expect(result.deliveryLastAttemptAt).toBeInstanceOf(Date);
      expect(result.deliveryNextRetryAt).toBeNull();
      expect(result.deliveredAt).toBeInstanceOf(Date);
    });

    it("returns 'retrying' status on failure with retries remaining", () => {
      const result = buildRetryUpdate(0, false);

      expect(result.deliveryStatus).toBe("retrying");
      expect(result.deliveryRetryCount).toBe(1);
      expect(result.deliveryLastAttemptAt).toBeInstanceOf(Date);
      expect(result.deliveryNextRetryAt).not.toBeNull();
      expect(result.deliveredAt).toBeUndefined();
    });

    it("returns 'failed' status when max retries exceeded", () => {
      const result = buildRetryUpdate(MAX_RETRY_ATTEMPTS - 1, false);

      expect(result.deliveryStatus).toBe("failed");
      expect(result.deliveryRetryCount).toBe(MAX_RETRY_ATTEMPTS);
      expect(result.deliveryNextRetryAt).toBeNull();
      expect(result.deliveredAt).toBeUndefined();
    });

    it("increments retry count on each attempt", () => {
      expect(buildRetryUpdate(0, false).deliveryRetryCount).toBe(1);
      expect(buildRetryUpdate(1, false).deliveryRetryCount).toBe(2);
      expect(buildRetryUpdate(2, false).deliveryRetryCount).toBe(3);
    });

    it("increments retry count on success too", () => {
      expect(buildRetryUpdate(2, true).deliveryRetryCount).toBe(3);
    });

    it("sets deliveryLastAttemptAt to current time", () => {
      const now = new Date();
      const result = buildRetryUpdate(0, false);
      expect(result.deliveryLastAttemptAt.getTime()).toBe(now.getTime());
    });
  });

  describe("MAX_RETRY_ATTEMPTS", () => {
    it("equals 5", () => {
      expect(MAX_RETRY_ATTEMPTS).toBe(5);
    });
  });
});
