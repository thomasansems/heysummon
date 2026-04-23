import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    helpRequest: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    apiKey: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    userProfile: {
      findUnique: vi.fn(),
    },
    expertChannel: {
      findFirst: vi.fn(),
    },
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
const mockUpdateMany = vi.mocked(prisma.helpRequest.updateMany);
const mockApiKeyFindFirst = vi.mocked(prisma.apiKey.findFirst);
const mockApiKeyUpdate = vi.mocked(prisma.apiKey.update);
const mockProfileFindUnique = vi.mocked(prisma.userProfile.findUnique);
const mockChannelFindFirst = vi.mocked(prisma.expertChannel.findFirst);
const mockValidateExpertKey = vi.mocked(validateExpertKey);

function makeRequest(apiKey: string): NextRequest {
  return new NextRequest("http://localhost/api/v1/events/pending", {
    method: "GET",
    headers: { "x-api-key": apiKey },
  });
}

describe("GET /api/v1/events/pending — notification mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateMany.mockResolvedValue({ count: 0 } as never);
    mockProfileFindUnique.mockResolvedValue(null as never);
    mockChannelFindFirst.mockResolvedValue(null as never);
    mockApiKeyUpdate.mockResolvedValue({} as never);
  });

  describe("expert branch", () => {
    beforeEach(() => {
      mockValidateExpertKey.mockResolvedValue({
        ok: true,
        expert: { id: "p-1", userId: "u-1" },
      } as never);
    });

    it("runs the expiry sweep before reading", async () => {
      mockFindMany.mockResolvedValue([] as never);

      await GET(makeRequest("hs_exp_test"));

      expect(mockUpdateMany).toHaveBeenCalledWith({
        where: {
          responseRequired: false,
          status: "pending",
          expiresAt: { lt: expect.any(Date) },
        },
        data: { status: "expired" },
      });
    });

    it("emits new_notification events for pending notification rows", async () => {
      mockFindMany.mockImplementation((args: unknown) => {
        const where = (args as { where: Record<string, unknown> }).where;
        if (where.responseRequired === true) return [] as never;
        if (where.responseRequired === false) {
          return [
            {
              id: "n-1",
              refCode: "ABC123",
              question: null,
              questionPreview: "Deploy finished",
              serverPrivateKey: null,
              createdAt: new Date("2026-04-23T10:00:00Z"),
              expiresAt: new Date("2026-04-30T10:00:00Z"),
            },
          ] as never;
        }
        return [] as never;
      });

      const res = await GET(makeRequest("hs_exp_test"));
      const json = await res.json();

      expect(json.events).toHaveLength(1);
      expect(json.events[0]).toMatchObject({
        type: "new_notification",
        requestId: "n-1",
        refCode: "ABC123",
        question: "Deploy finished",
        messageCount: 0,
        createdAt: "2026-04-23T10:00:00.000Z",
        expiresAt: "2026-04-30T10:00:00.000Z",
      });
    });

    it("scopes the help-request query to responseRequired=true only", async () => {
      mockFindMany.mockResolvedValue([] as never);

      await GET(makeRequest("hs_exp_test"));

      const helpCall = mockFindMany.mock.calls.find((c) => {
        const where = (c[0] as { where: Record<string, unknown> }).where;
        return where.responseRequired === true;
      });
      expect(helpCall).toBeDefined();
    });
  });

  describe("consumer branch", () => {
    beforeEach(() => {
      mockApiKeyFindFirst.mockResolvedValue({
        id: "k-1",
        userId: "u-2",
        lastPollAt: new Date("2026-04-23T09:00:00Z"),
        isActive: true,
      } as never);
    });

    it("emits notification_acknowledged when ack is newer than consumerDeliveredAt", async () => {
      mockFindMany.mockImplementation((args: unknown) => {
        const where = (args as { where: Record<string, unknown> }).where;
        if (where.responseRequired === false) {
          return [
            {
              id: "n-1",
              refCode: "REF1",
              status: "acknowledged",
              acknowledgedAt: new Date("2026-04-23T11:00:00Z"),
              expiresAt: new Date("2026-04-30T10:00:00Z"),
              consumerDeliveredAt: new Date("2026-04-23T10:00:00Z"),
            },
          ] as never;
        }
        return [] as never;
      });

      const res = await GET(makeRequest("hs_cli_test"));
      const json = await res.json();

      expect(json.events).toContainEqual({
        type: "notification_acknowledged",
        requestId: "n-1",
        refCode: "REF1",
        acknowledgedAt: "2026-04-23T11:00:00.000Z",
      });
    });

    it("suppresses notification_acknowledged once consumer has ACKed past it", async () => {
      mockFindMany.mockImplementation((args: unknown) => {
        const where = (args as { where: Record<string, unknown> }).where;
        if (where.responseRequired === false) {
          return [
            {
              id: "n-1",
              refCode: "REF1",
              status: "acknowledged",
              acknowledgedAt: new Date("2026-04-23T11:00:00Z"),
              expiresAt: new Date("2026-04-30T10:00:00Z"),
              consumerDeliveredAt: new Date("2026-04-23T12:00:00Z"),
            },
          ] as never;
        }
        return [] as never;
      });

      const res = await GET(makeRequest("hs_cli_test"));
      const json = await res.json();

      expect(json.events).toEqual([]);
    });

    it("emits notification_expired for status=expired past the consumer ACK cursor", async () => {
      mockFindMany.mockImplementation((args: unknown) => {
        const where = (args as { where: Record<string, unknown> }).where;
        if (where.responseRequired === false) {
          return [
            {
              id: "n-2",
              refCode: "REF2",
              status: "expired",
              acknowledgedAt: null,
              expiresAt: new Date("2026-04-23T11:30:00Z"),
              consumerDeliveredAt: new Date("2026-04-23T10:00:00Z"),
            },
          ] as never;
        }
        return [] as never;
      });

      const res = await GET(makeRequest("hs_cli_test"));
      const json = await res.json();

      expect(json.events).toContainEqual({
        type: "notification_expired",
        requestId: "n-2",
        refCode: "REF2",
        expiredAt: "2026-04-23T11:30:00.000Z",
      });
    });

    it("emits both event types if the consumer has never ACKed", async () => {
      mockFindMany.mockImplementation((args: unknown) => {
        const where = (args as { where: Record<string, unknown> }).where;
        if (where.responseRequired === false) {
          return [
            {
              id: "n-1",
              refCode: "REF1",
              status: "acknowledged",
              acknowledgedAt: new Date("2026-04-23T11:00:00Z"),
              expiresAt: new Date("2026-04-30T10:00:00Z"),
              consumerDeliveredAt: null,
            },
            {
              id: "n-2",
              refCode: "REF2",
              status: "expired",
              acknowledgedAt: null,
              expiresAt: new Date("2026-04-23T11:30:00Z"),
              consumerDeliveredAt: null,
            },
          ] as never;
        }
        return [] as never;
      });

      const res = await GET(makeRequest("hs_cli_test"));
      const json = await res.json();

      expect(json.events).toHaveLength(2);
      expect(json.events.map((e: { type: string }) => e.type).sort()).toEqual([
        "notification_acknowledged",
        "notification_expired",
      ]);
    });
  });
});
