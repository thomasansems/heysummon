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

/**
 * Contract sanity (HEY-358 plan §9.3).
 *
 * The three notification event types are part of the consumer SDK / expert API
 * contract. These snapshots lock down the exact wire shape — adding or removing
 * a field will break consumers and must be a deliberate, reviewed change.
 */
describe("poll response shape — notification event contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateMany.mockResolvedValue({ count: 0 } as never);
    mockProfileFindUnique.mockResolvedValue(null as never);
    mockChannelFindFirst.mockResolvedValue(null as never);
    mockApiKeyUpdate.mockResolvedValue({} as never);
  });

  it("expert poll: new_notification event has the expected fields", async () => {
    mockValidateExpertKey.mockResolvedValue({
      ok: true,
      expert: { id: "p-1", userId: "u-1" },
    } as never);

    mockFindMany.mockImplementation((args: unknown) => {
      const where = (args as { where: Record<string, unknown> }).where;
      if (where.responseRequired === false) {
        return [
          {
            id: "n-1",
            refCode: "REF-NEW",
            question: null,
            questionPreview: "Deploy finished",
            serverPrivateKey: null,
            createdAt: new Date("2026-04-23T10:00:00.000Z"),
            expiresAt: new Date("2026-04-30T10:00:00.000Z"),
          },
        ] as never;
      }
      return [] as never;
    });

    const res = await GET(makeRequest("hs_exp_test"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toMatchInlineSnapshot(`
      {
        "events": [
          {
            "createdAt": "2026-04-23T10:00:00.000Z",
            "expiresAt": "2026-04-30T10:00:00.000Z",
            "messageCount": 0,
            "question": "Deploy finished",
            "refCode": "REF-NEW",
            "requestId": "n-1",
            "type": "new_notification",
          },
        ],
      }
    `);

    // Belt-and-braces: lock the field set explicitly so accidental additions
    // also fail a more readable assertion than the snapshot diff.
    const event = json.events[0];
    expect(Object.keys(event).sort()).toEqual([
      "createdAt",
      "expiresAt",
      "messageCount",
      "question",
      "refCode",
      "requestId",
      "type",
    ]);
  });

  it("consumer poll: notification_acknowledged event has the expected fields", async () => {
    mockApiKeyFindFirst.mockResolvedValue({
      id: "k-1",
      userId: "u-2",
      lastPollAt: new Date("2026-04-23T09:00:00.000Z"),
      isActive: true,
    } as never);

    mockFindMany.mockImplementation((args: unknown) => {
      const where = (args as { where: Record<string, unknown> }).where;
      if (where.responseRequired === false) {
        return [
          {
            id: "n-2",
            refCode: "REF-ACK",
            status: "acknowledged",
            acknowledgedAt: new Date("2026-04-23T11:00:00.000Z"),
            expiresAt: new Date("2026-04-30T10:00:00.000Z"),
            consumerDeliveredAt: null,
          },
        ] as never;
      }
      return [] as never;
    });

    const res = await GET(makeRequest("hs_cli_test"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toMatchInlineSnapshot(`
      {
        "events": [
          {
            "acknowledgedAt": "2026-04-23T11:00:00.000Z",
            "refCode": "REF-ACK",
            "requestId": "n-2",
            "type": "notification_acknowledged",
          },
        ],
      }
    `);

    const event = json.events[0];
    expect(Object.keys(event).sort()).toEqual([
      "acknowledgedAt",
      "refCode",
      "requestId",
      "type",
    ]);
  });

  it("consumer poll: notification_expired event has the expected fields", async () => {
    mockApiKeyFindFirst.mockResolvedValue({
      id: "k-1",
      userId: "u-2",
      lastPollAt: new Date("2026-04-23T09:00:00.000Z"),
      isActive: true,
    } as never);

    mockFindMany.mockImplementation((args: unknown) => {
      const where = (args as { where: Record<string, unknown> }).where;
      if (where.responseRequired === false) {
        return [
          {
            id: "n-3",
            refCode: "REF-EXP",
            status: "expired",
            acknowledgedAt: null,
            expiresAt: new Date("2026-04-23T11:30:00.000Z"),
            consumerDeliveredAt: null,
          },
        ] as never;
      }
      return [] as never;
    });

    const res = await GET(makeRequest("hs_cli_test"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toMatchInlineSnapshot(`
      {
        "events": [
          {
            "expiredAt": "2026-04-23T11:30:00.000Z",
            "refCode": "REF-EXP",
            "requestId": "n-3",
            "type": "notification_expired",
          },
        ],
      }
    `);

    const event = json.events[0];
    expect(Object.keys(event).sort()).toEqual([
      "expiredAt",
      "refCode",
      "requestId",
      "type",
    ]);
  });

  it("response envelope is always { events: [...] }", async () => {
    mockValidateExpertKey.mockResolvedValue({
      ok: true,
      expert: { id: "p-1", userId: "u-1" },
    } as never);
    mockFindMany.mockResolvedValue([] as never);

    const res = await GET(makeRequest("hs_exp_test"));
    const json = await res.json();

    expect(Object.keys(json)).toEqual(["events"]);
    expect(Array.isArray(json.events)).toBe(true);
  });
});
