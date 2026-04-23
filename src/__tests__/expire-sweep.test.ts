import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    helpRequest: {
      updateMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { sweepExpiredNotifications } from "@/services/notifications/expire";

const mockUpdateMany = vi.mocked(prisma.helpRequest.updateMany);

describe("sweepExpiredNotifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateMany.mockResolvedValue({ count: 0 } as never);
  });

  it("flips pending notification rows past expiresAt to expired", async () => {
    await sweepExpiredNotifications();

    expect(mockUpdateMany).toHaveBeenCalledTimes(1);
    const call = mockUpdateMany.mock.calls[0]?.[0] as {
      where: {
        responseRequired: boolean;
        status: string;
        expiresAt: { lt: Date };
      };
      data: { status: string };
    };

    expect(call.where.responseRequired).toBe(false);
    expect(call.where.status).toBe("pending");
    expect(call.where.expiresAt.lt).toBeInstanceOf(Date);
    expect(call.data.status).toBe("expired");
  });

  it("uses the current time as the cutoff", async () => {
    const before = Date.now();
    await sweepExpiredNotifications();
    const after = Date.now();

    const call = mockUpdateMany.mock.calls[0]?.[0] as {
      where: { expiresAt: { lt: Date } };
    };
    const cutoff = call.where.expiresAt.lt.getTime();
    expect(cutoff).toBeGreaterThanOrEqual(before);
    expect(cutoff).toBeLessThanOrEqual(after);
  });
});
