import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock dependencies before imports
vi.mock("@/lib/prisma", () => ({
  prisma: {
    helpRequest: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/request-lifecycle", () => ({
  transitionRequest: vi.fn(),
  StaleStateError: class StaleStateError extends Error {
    constructor(msg?: string) {
      super(msg ?? "stale");
      this.name = "StaleStateError";
    }
  },
}));

vi.mock("@/lib/delivery-retry", () => ({
  buildRetryUpdate: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({
  logAuditEvent: vi.fn(),
  AuditEventTypes: {
    DELIVERY_RETRY_ATTEMPTED: "DELIVERY_RETRY_ATTEMPTED",
    ESCALATION_TRIGGERED: "ESCALATION_TRIGGERED",
  },
}));

vi.mock("@/lib/provider-metrics", () => ({
  recalculateMetrics: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { transitionRequest, StaleStateError } from "@/lib/request-lifecycle";
import { buildRetryUpdate } from "@/lib/delivery-retry";
import { logAuditEvent } from "@/lib/audit";
import { recalculateMetrics } from "@/lib/provider-metrics";
import { runMonitorCycle } from "@/lib/active-monitor";

const mockFindMany = vi.mocked(prisma.helpRequest.findMany);
const mockUpdate = vi.mocked(prisma.helpRequest.update);
const mockTransition = vi.mocked(transitionRequest);
const mockBuildRetry = vi.mocked(buildRetryUpdate);
const mockLogAudit = vi.mocked(logAuditEvent);
const mockRecalcMetrics = vi.mocked(recalculateMetrics);

describe("active-monitor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no records found for any query
    mockFindMany.mockResolvedValue([]);
  });

  describe("expireStaleRequests", () => {
    it("transitions stale pending/active requests to expired", async () => {
      // First findMany call returns stale requests (expire job)
      mockFindMany.mockResolvedValueOnce([
        { id: "req-1", status: "pending", expertId: "prov-1" },
        { id: "req-2", status: "active", expertId: null },
      ] as never);
      mockTransition.mockResolvedValue(undefined as never);

      await runMonitorCycle();

      expect(mockTransition).toHaveBeenCalledWith(
        "req-1",
        "pending",
        "expired",
        expect.objectContaining({ actor: "system:active-monitor" })
      );
      expect(mockTransition).toHaveBeenCalledWith(
        "req-2",
        "active",
        "expired",
        expect.objectContaining({ actor: "system:active-monitor" })
      );
    });

    it("recalculates metrics for expired requests with an expertId", async () => {
      mockFindMany.mockResolvedValueOnce([
        { id: "req-1", status: "pending", expertId: "prov-1" },
      ] as never);
      mockTransition.mockResolvedValue(undefined as never);

      await runMonitorCycle();

      expect(mockRecalcMetrics).toHaveBeenCalledWith("prov-1");
    });

    it("skips metrics recalculation when no expertId", async () => {
      mockFindMany.mockResolvedValueOnce([
        { id: "req-1", status: "pending", expertId: null },
      ] as never);
      mockTransition.mockResolvedValue(undefined as never);

      await runMonitorCycle();

      expect(mockRecalcMetrics).not.toHaveBeenCalled();
    });

    it("silently handles StaleStateError (another actor transitioned)", async () => {
      mockFindMany.mockResolvedValueOnce([
        { id: "req-1", status: "pending", expertId: null },
      ] as never);
      mockTransition.mockRejectedValueOnce(new StaleStateError("already transitioned"));

      // Should not throw
      await expect(runMonitorCycle()).resolves.toBeUndefined();
    });

    it("logs non-StaleStateError errors without crashing", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      mockFindMany.mockResolvedValueOnce([
        { id: "req-1", status: "pending", expertId: null },
      ] as never);
      mockTransition.mockRejectedValueOnce(new Error("db error"));

      await expect(runMonitorCycle()).resolves.toBeUndefined();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to expire req-1"),
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });

  describe("retryDeliveries", () => {
    it("retries deliveries with past nextRetryAt", async () => {
      // First call (expire) returns empty, second call (retry) returns retryable
      mockFindMany
        .mockResolvedValueOnce([]) // expire
        .mockResolvedValueOnce([
          { id: "req-1", deliveryRetryCount: 1, expertId: "prov-1", refCode: "ABC" },
        ] as never)
        .mockResolvedValueOnce([]); // escalate

      const retryUpdate = {
        deliveryStatus: "retrying",
        deliveryRetryCount: 2,
        deliveryLastAttemptAt: new Date(),
        deliveryNextRetryAt: new Date(Date.now() + 600_000),
      };
      mockBuildRetry.mockReturnValue(retryUpdate);
      mockUpdate.mockResolvedValue({} as never);

      await runMonitorCycle();

      expect(mockBuildRetry).toHaveBeenCalledWith(1, false);
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: "req-1" },
        data: retryUpdate,
      });
      expect(mockLogAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "DELIVERY_RETRY_ATTEMPTED",
          success: true,
        })
      );
    });
  });

  describe("escalateRequests", () => {
    it("escalates unacknowledged pending requests older than 30 minutes", async () => {
      // First two calls (expire, retry) return empty, third (escalate) returns match
      mockFindMany
        .mockResolvedValueOnce([]) // expire
        .mockResolvedValueOnce([]) // retry
        .mockResolvedValueOnce([
          { id: "req-1", expertId: "prov-1", refCode: "XYZ" },
        ] as never);

      mockUpdate.mockResolvedValue({} as never);

      await runMonitorCycle();

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "req-1" },
          data: { escalatedAt: expect.any(Date) },
        })
      );
      expect(mockLogAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "ESCALATION_TRIGGERED",
          metadata: expect.objectContaining({ reason: "unacknowledged_30min" }),
        })
      );
    });
  });

  describe("runMonitorCycle", () => {
    it("runs all three jobs in parallel without throwing", async () => {
      await expect(runMonitorCycle()).resolves.toBeUndefined();
    });

    it("handles top-level errors gracefully", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      mockFindMany.mockRejectedValue(new Error("connection lost"));

      await expect(runMonitorCycle()).resolves.toBeUndefined();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Cycle failed"),
      );
      consoleSpy.mockRestore();
    });
  });
});
