import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    userProfile: {
      findFirst: vi.fn(),
    },
    helpRequest: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    message: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/api-key-auth", () => ({
  validateApiKeyRequest: vi.fn(),
  sanitizeError: (e: unknown) => e,
}));

vi.mock("@/lib/audit", () => ({
  logAuditEvent: vi.fn(),
  AuditEventTypes: { EXPERT_RESPONSE: "EXPERT_RESPONSE" },
}));

vi.mock("@/lib/content-safety-middleware", () => ({
  checkContentSafety: vi.fn(() => ({ passed: true, flags: [], sanitizedText: null })),
}));

import { prisma } from "@/lib/prisma";
import { POST } from "@/app/api/v1/message/[requestId]/route";
import { NextRequest } from "next/server";

const mockExpertFindFirst = vi.mocked(prisma.userProfile.findFirst);
const mockHelpRequestFindFirst = vi.mocked(prisma.helpRequest.findFirst);
const mockHelpRequestFindUnique = vi.mocked(prisma.helpRequest.findUnique);
const mockHelpRequestUpdate = vi.mocked(prisma.helpRequest.update);
const mockMessageFindUnique = vi.mocked(prisma.message.findUnique);
const mockMessageCreate = vi.mocked(prisma.message.create);

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost/api/v1/message/req-1", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": "hs_exp_test",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/v1/message/:requestId — responseRequired guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExpertFindFirst.mockResolvedValue({ id: "p-1", userId: "u-1" } as never);
    mockHelpRequestFindFirst.mockResolvedValue({
      id: "req-1",
      expertId: "u-1",
    } as never);
    mockMessageFindUnique.mockResolvedValue(null);
    mockMessageCreate.mockResolvedValue({
      messageId: "m-1",
      createdAt: new Date("2026-04-23T00:00:00.000Z"),
    } as never);
    mockHelpRequestUpdate.mockResolvedValue({} as never);
  });

  it("returns 409 NO_RESPONSE_REQUIRED when posting to a notification-mode request", async () => {
    mockHelpRequestFindUnique.mockResolvedValue({
      id: "req-1",
      status: "pending",
      responseRequired: false,
      expertSignPubKey: "x",
      expertEncryptPubKey: "y",
      consumerSignPubKey: "x",
      consumerEncryptPubKey: "y",
      refCode: "HS-NOTIFY",
    } as never);

    const res = await POST(
      makeRequest({ from: "expert", plaintext: "hello" }),
      { params: Promise.resolve({ requestId: "req-1" }) }
    );

    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json).toEqual({
      error: "This request is notification-mode; messages are not accepted",
      code: "NO_RESPONSE_REQUIRED",
    });
    expect(mockMessageCreate).not.toHaveBeenCalled();
  });

  it("allows posting to a standard help request (responseRequired=true)", async () => {
    mockHelpRequestFindUnique.mockResolvedValue({
      id: "req-1",
      status: "active",
      responseRequired: true,
      expertSignPubKey: "x",
      expertEncryptPubKey: "y",
      consumerSignPubKey: "x",
      consumerEncryptPubKey: "y",
      refCode: "HS-HELP",
    } as never);

    const res = await POST(
      makeRequest({ from: "expert", plaintext: "hello" }),
      { params: Promise.resolve({ requestId: "req-1" }) }
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.messageId).toBeDefined();
    expect(mockMessageCreate).toHaveBeenCalledTimes(1);
  });
});
