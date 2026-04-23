import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    helpRequest: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/api-key-auth", () => ({
  validateApiKeyRequest: vi.fn(),
  sanitizeError: (e: unknown) => e,
}));

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { validateApiKeyRequest } from "@/lib/api-key-auth";
import { POST } from "@/app/api/v1/acknowledge/[requestId]/route";

const mockFindFirst = vi.mocked(prisma.helpRequest.findFirst);
const mockUpdate = vi.mocked(prisma.helpRequest.update);
const mockGetCurrentUser = vi.mocked(getCurrentUser);
const mockValidateApiKey = vi.mocked(validateApiKeyRequest);

function makeRequest(): Request {
  return new Request("http://localhost/api/v1/acknowledge/req-1", {
    method: "POST",
    headers: { "x-api-key": "hs_exp_test" },
  });
}

function makeParams(requestId = "req-1") {
  return { params: Promise.resolve({ requestId }) };
}

describe("POST /api/v1/acknowledge/:requestId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(null);
    mockValidateApiKey.mockResolvedValue({
      ok: true,
      apiKey: { id: "key-1", userId: "user-1" },
    } as never);
    mockUpdate.mockResolvedValue({} as never);
  });

  it("returns 200 and acknowledges a notification-mode request (idempotent on second call)", async () => {
    mockFindFirst.mockResolvedValueOnce({
      id: "req-1",
      status: "pending",
      responseRequired: false,
      acknowledgedAt: null,
    } as never);

    const res = await POST(makeRequest(), makeParams());

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.status).toBe("acknowledged");
    expect(typeof json.acknowledgedAt).toBe("string");
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "req-1" },
        data: expect.objectContaining({ status: "acknowledged" }),
      })
    );

    const frozenAckAt = new Date("2026-04-23T10:00:00.000Z");
    mockFindFirst.mockResolvedValueOnce({
      id: "req-1",
      status: "acknowledged",
      responseRequired: false,
      acknowledgedAt: frozenAckAt,
    } as never);

    const res2 = await POST(makeRequest(), makeParams());
    expect(res2.status).toBe(200);
    const json2 = await res2.json();
    expect(json2.status).toBe("acknowledged");
    expect(json2.acknowledgedAt).toBe(frozenAckAt.toISOString());
    expect(mockUpdate).toHaveBeenCalledTimes(1); // not called again
  });

  it("returns 404 when the request is not found or not owned", async () => {
    mockFindFirst.mockResolvedValue(null);

    const res = await POST(makeRequest(), makeParams("missing"));

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toMatch(/not found/i);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("returns 409 NOT_APPLICABLE when the request expects a reply", async () => {
    mockFindFirst.mockResolvedValue({
      id: "req-1",
      status: "pending",
      responseRequired: true,
      acknowledgedAt: null,
    } as never);

    const res = await POST(makeRequest(), makeParams());

    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.code).toBe("NOT_APPLICABLE");
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("returns 401 when neither session nor API key authenticates", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    mockValidateApiKey.mockResolvedValue({
      ok: false,
      response: Response.json(
        { error: "x-api-key header required" },
        { status: 401 }
      ),
    } as never);

    const res = await POST(
      new Request("http://localhost/api/v1/acknowledge/req-1", {
        method: "POST",
      }),
      makeParams()
    );

    expect(res.status).toBe(401);
    expect(mockFindFirst).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("uses session user when authenticated (dashboard path)", async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: "session-user",
      email: "e@example.com",
      name: "Expert",
      role: "user",
      onboardingComplete: true,
    } as never);
    mockFindFirst.mockResolvedValue({
      id: "req-1",
      status: "pending",
      responseRequired: false,
      acknowledgedAt: null,
    } as never);

    const res = await POST(makeRequest(), makeParams());

    expect(res.status).toBe(200);
    expect(mockValidateApiKey).not.toHaveBeenCalled();
    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "req-1", expertId: "session-user" },
      })
    );
  });
});
