import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    helpRequest: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    apiKey: { findFirst: vi.fn(), update: vi.fn() },
    userProfile: { findUnique: vi.fn() },
    expertChannel: { findFirst: vi.fn() },
  },
}));

vi.mock("@/lib/expert-key-auth", () => ({
  validateExpertKey: vi.fn(),
}));

vi.mock("@/lib/crypto", () => ({
  decryptMessage: vi.fn(() => null),
}));

vi.mock("@/lib/audit", () => ({
  logAuditEvent: vi.fn(),
  AuditEventTypes: { CONSUMER_CONNECTED: "CONSUMER_CONNECTED" },
}));

vi.mock("@/lib/adapters/telegram", () => ({
  sendMessage: vi.fn(),
  escapeTelegramMarkdown: (s: string) => s,
}));

import { prisma } from "@/lib/prisma";
import { validateExpertKey } from "@/lib/expert-key-auth";
import { GET } from "@/app/api/v1/events/pending/route";
import { NextRequest } from "next/server";

const mockFindMany = vi.mocked(prisma.helpRequest.findMany);

function makeExpertReq() {
  return new NextRequest("http://localhost/api/v1/events/pending", {
    method: "GET",
    headers: { "x-api-key": "hs_exp_test" },
  });
}

describe("GET /api/v1/events/pending applies probe filter on every helpRequest list", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateExpertKey).mockResolvedValue({
      ok: true,
      expert: { id: "p-1", userId: "u-1" },
    } as never);
    vi.mocked(prisma.helpRequest.updateMany).mockResolvedValue({ count: 0 } as never);
    vi.mocked(prisma.userProfile.findUnique).mockResolvedValue(null as never);
    vi.mocked(prisma.expertChannel.findFirst).mockResolvedValue(null as never);
    mockFindMany.mockResolvedValue([] as never);
  });

  it("includes probe: false in every where clause for the expert branch", async () => {
    await GET(makeExpertReq());

    // Both expert-branch findMany calls should carry probe: false.
    const calls = mockFindMany.mock.calls;
    expect(calls.length).toBeGreaterThanOrEqual(2);
    for (const call of calls) {
      const where = (call[0] as { where: Record<string, unknown> }).where;
      expect(where).toHaveProperty("probe", false);
    }
  });
});
