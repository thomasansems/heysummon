import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    helpRequest: { findUnique: vi.fn() },
    apiKey: { findUnique: vi.fn(), findFirst: vi.fn() },
    rateLimit: { upsert: vi.fn() },
    ipEvent: { findFirst: vi.fn(), upsert: vi.fn() },
  },
}));

vi.mock("@/lib/api-key-auth", () => ({
  validateApiKeyRequest: vi.fn(),
  sanitizeError: (err: unknown) => err,
}));

import { prisma } from "@/lib/prisma";
import { validateApiKeyRequest } from "@/lib/api-key-auth";
import { GET } from "@/app/api/v1/messages/[requestId]/route";

const mockFindUnique = vi.mocked(prisma.helpRequest.findUnique);
const mockValidate = vi.mocked(validateApiKeyRequest);

function makeRequest() {
  return new Request("https://example.com/api/v1/messages/req-1", {
    method: "GET",
    headers: { "x-api-key": "hs_cli_caller" },
  });
}

describe("GET /api/v1/messages/[requestId] — cross-tenant scoping (HEY-403)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 when the request belongs to a different API key", async () => {
    mockValidate.mockResolvedValue({
      ok: true,
      apiKey: { id: "key-caller", key: "hs_cli_caller" },
    } as never);
    mockFindUnique.mockResolvedValue({
      id: "req-1",
      apiKeyId: "key-other-tenant",
      refCode: "HS-OTHER",
      status: "responded",
      consumerSignPubKey: null,
      consumerEncryptPubKey: null,
      expertSignPubKey: null,
      expertEncryptPubKey: null,
      messageHistory: [
        {
          id: "m-1",
          from: "expert",
          ciphertext: "secret-blob",
          iv: "iv",
          authTag: "tag",
          signature: "sig",
          messageId: "mid-1",
          createdAt: new Date(),
        },
      ],
      expiresAt: new Date(Date.now() + 60_000),
    } as never);

    const res = await GET(makeRequest(), {
      params: Promise.resolve({ requestId: "req-1" }),
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toEqual({ error: "Request not found" });
  });

  it("returns the messages when the API key owns the request", async () => {
    mockValidate.mockResolvedValue({
      ok: true,
      apiKey: { id: "key-owner", key: "hs_cli_caller" },
    } as never);
    mockFindUnique.mockResolvedValue({
      id: "req-1",
      apiKeyId: "key-owner",
      refCode: "HS-OWNER",
      status: "responded",
      consumerSignPubKey: "csp",
      consumerEncryptPubKey: "cep",
      expertSignPubKey: "esp",
      expertEncryptPubKey: "eep",
      messageHistory: [
        {
          id: "m-1",
          from: "expert",
          ciphertext: "secret-blob",
          iv: "iv",
          authTag: "tag",
          signature: "sig",
          messageId: "mid-1",
          createdAt: new Date(),
        },
      ],
      expiresAt: new Date(Date.now() + 60_000),
    } as never);

    const res = await GET(makeRequest(), {
      params: Promise.resolve({ requestId: "req-1" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.requestId).toBe("req-1");
    expect(body.refCode).toBe("HS-OWNER");
    expect(body.messages).toHaveLength(1);
    expect(body.messages[0].ciphertext).toBe("secret-blob");
  });

  it("returns 404 when the request id does not exist", async () => {
    mockValidate.mockResolvedValue({
      ok: true,
      apiKey: { id: "key-caller", key: "hs_cli_caller" },
    } as never);
    mockFindUnique.mockResolvedValue(null as never);

    const res = await GET(makeRequest(), {
      params: Promise.resolve({ requestId: "req-missing" }),
    });

    expect(res.status).toBe(404);
  });

  it("propagates the auth error response when the api key is invalid", async () => {
    const authResponse = new Response(JSON.stringify({ error: "unauth" }), {
      status: 401,
    });
    mockValidate.mockResolvedValue({ ok: false, response: authResponse } as never);

    const res = await GET(makeRequest(), {
      params: Promise.resolve({ requestId: "req-1" }),
    });

    expect(res.status).toBe(401);
    expect(mockFindUnique).not.toHaveBeenCalled();
  });
});
