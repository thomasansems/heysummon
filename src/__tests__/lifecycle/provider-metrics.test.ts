import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Prisma before imports
vi.mock("@/lib/prisma", () => ({
  prisma: {
    helpRequest: {
      count: vi.fn(),
      aggregate: vi.fn(),
    },
    providerMetrics: {
      upsert: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { recalculateMetrics } from "@/lib/provider-metrics";

const mockCount = vi.mocked(prisma.helpRequest.count);
const mockAggregate = vi.mocked(prisma.helpRequest.aggregate);
const mockUpsert = vi.mocked(prisma.providerMetrics.upsert);

describe("provider-metrics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpsert.mockResolvedValue({} as never);
  });

  it("calculates correct metrics for a provider with history", async () => {
    // responded count
    mockCount
      .mockResolvedValueOnce(10) // totalResponded (status: "responded")
      .mockResolvedValueOnce(5)  // totalRespondedAndClosed (status: "closed", respondedAt not null)
      .mockResolvedValueOnce(3); // totalExpired

    mockAggregate
      .mockResolvedValueOnce({ _avg: { rating: 4.5 } } as never) // avg rating
      .mockResolvedValueOnce({ _avg: { responseTimeMs: 120_000 } } as never); // avg response time

    await recalculateMetrics("prov-1");

    expect(mockUpsert).toHaveBeenCalledWith({
      where: { providerId: "prov-1" },
      create: {
        providerId: "prov-1",
        avgRating: 4.5,
        avgResponseTimeMs: 120_000,
        totalResponded: 15, // 10 + 5
        totalExpired: 3,
        reliability: 15 / 18, // 15 / (15 + 3)
      },
      update: {
        avgRating: 4.5,
        avgResponseTimeMs: 120_000,
        totalResponded: 15,
        totalExpired: 3,
        reliability: 15 / 18,
      },
    });
  });

  it("handles provider with no requests (empty state)", async () => {
    mockCount
      .mockResolvedValueOnce(0) // responded
      .mockResolvedValueOnce(0) // closed+responded
      .mockResolvedValueOnce(0); // expired

    mockAggregate
      .mockResolvedValueOnce({ _avg: { rating: null } } as never)
      .mockResolvedValueOnce({ _avg: { responseTimeMs: null } } as never);

    await recalculateMetrics("prov-empty");

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          providerId: "prov-empty",
          avgRating: null,
          avgResponseTimeMs: null,
          totalResponded: 0,
          totalExpired: 0,
          reliability: null, // 0 total, so null
        }),
      })
    );
  });

  it("calculates 100% reliability when no expired requests", async () => {
    mockCount
      .mockResolvedValueOnce(8)  // responded
      .mockResolvedValueOnce(2)  // closed+responded
      .mockResolvedValueOnce(0); // expired

    mockAggregate
      .mockResolvedValueOnce({ _avg: { rating: 5.0 } } as never)
      .mockResolvedValueOnce({ _avg: { responseTimeMs: 60_000 } } as never);

    await recalculateMetrics("prov-reliable");

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          reliability: 1.0, // 10 / (10 + 0)
        }),
      })
    );
  });

  it("calculates 0% reliability when all requests expired", async () => {
    mockCount
      .mockResolvedValueOnce(0)  // responded
      .mockResolvedValueOnce(0)  // closed+responded
      .mockResolvedValueOnce(5); // expired

    mockAggregate
      .mockResolvedValueOnce({ _avg: { rating: null } } as never)
      .mockResolvedValueOnce({ _avg: { responseTimeMs: null } } as never);

    await recalculateMetrics("prov-unreliable");

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          reliability: 0, // 0 / (0 + 5)
          totalExpired: 5,
        }),
      })
    );
  });

  it("handles database errors gracefully without throwing", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockCount.mockRejectedValue(new Error("db error"));

    await expect(recalculateMetrics("prov-error")).resolves.toBeUndefined();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Recalculation failed"),
      expect.any(Error)
    );
    consoleSpy.mockRestore();
  });
});
