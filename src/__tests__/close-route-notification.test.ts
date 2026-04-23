import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    helpRequest: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/api-key-auth", () => ({
  validateApiKeyRequest: vi.fn(),
  sanitizeError: (e: unknown) => e,
}));

import { prisma } from "@/lib/prisma";
import { validateApiKeyRequest } from "@/lib/api-key-auth";
import { POST } from "@/app/api/v1/close/[requestId]/route";

const mockFindFirst = vi.mocked(prisma.helpRequest.findFirst);
const mockUpdate = vi.mocked(prisma.helpRequest.update);
const mockValidateApiKey = vi.mocked(validateApiKeyRequest);

function makeRequest(): Request {
  return new Request("http://localhost/api/v1/close/req-1", {
    method: "POST",
    headers: { "x-api-key": "hs_exp_test" },
  });
}

function makeParams(requestId = "req-1") {
  return { params: Promise.resolve({ requestId }) };
}

describe("POST /api/v1/close/:requestId — notification guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateApiKey.mockResolvedValue({
      ok: true,
      apiKey: { id: "key-1", userId: "user-1" },
    } as never);
    mockUpdate.mockResolvedValue({} as never);
  });

  it("returns 409 NOT_APPLICABLE when closing a notification-mode request", async () => {
    mockFindFirst.mockResolvedValue({
      id: "req-1",
      status: "pending",
      responseRequired: false,
      acknowledgedAt: null,
      closedAt: null,
    } as never);

    const res = await POST(makeRequest(), makeParams());

    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.code).toBe("NOT_APPLICABLE");
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("is idempotent on acknowledged notifications (200 with status=acknowledged)", async () => {
    const ackAt = new Date("2026-04-23T10:00:00.000Z");
    mockFindFirst.mockResolvedValue({
      id: "req-1",
      status: "acknowledged",
      responseRequired: false,
      acknowledgedAt: ackAt,
      closedAt: null,
    } as never);

    const res = await POST(makeRequest(), makeParams());

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.status).toBe("acknowledged");
    expect(json.acknowledgedAt).toBe(ackAt.toISOString());
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("is idempotent on expired notifications (200 with status=expired)", async () => {
    mockFindFirst.mockResolvedValue({
      id: "req-1",
      status: "expired",
      responseRequired: false,
      acknowledgedAt: null,
      closedAt: null,
    } as never);

    const res = await POST(makeRequest(), makeParams());

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("expired");
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("closes a normal help request (responseRequired=true) as before", async () => {
    mockFindFirst.mockResolvedValue({
      id: "req-1",
      status: "active",
      responseRequired: true,
      acknowledgedAt: null,
      closedAt: null,
    } as never);

    const res = await POST(makeRequest(), makeParams());

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("closed");
    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });
});
