import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import crypto from "crypto";

// Mock prisma before importing the module under test
vi.mock("@/lib/prisma", () => ({
  prisma: {
    apiKey: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    ipEvent: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
    rateLimit: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import {
  getHmacSecret,
  hashDeviceToken,
  generateDeviceSecret,
  redactKey,
  isScopeAllowed,
  sanitizeError,
  isKeyRateLimited,
  validateApiKeyRequest,
} from "./api-key-auth";

const TEST_SECRET = "test-secret-for-hmac-operations";

function makeRequest(
  headers: Record<string, string> = {},
  method = "GET"
): Request {
  return {
    method,
    headers: new Headers(headers),
  } as unknown as Request;
}

function makeKeyRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "key_1",
    key: "hs_cli_abc123",
    userId: "user_1",
    isActive: true,
    scope: "full",
    deviceSecret: null,
    machineId: null,
    rateLimitPerMinute: 60,
    previousKeyHash: null,
    previousKeyExpiresAt: null,
    ...overrides,
  };
}

// ── Pure functions ──

describe("getHmacSecret", () => {
  const original = process.env.NEXTAUTH_SECRET;

  afterEach(() => {
    if (original !== undefined) {
      process.env.NEXTAUTH_SECRET = original;
    } else {
      delete process.env.NEXTAUTH_SECRET;
    }
  });

  it("returns the secret when NEXTAUTH_SECRET is set", () => {
    process.env.NEXTAUTH_SECRET = "my-secret";
    expect(getHmacSecret()).toBe("my-secret");
  });

  it("throws when NEXTAUTH_SECRET is not set", () => {
    delete process.env.NEXTAUTH_SECRET;
    expect(() => getHmacSecret()).toThrow("NEXTAUTH_SECRET is not set");
  });

  it("throws when NEXTAUTH_SECRET is empty string", () => {
    process.env.NEXTAUTH_SECRET = "";
    expect(() => getHmacSecret()).toThrow("NEXTAUTH_SECRET is not set");
  });
});

describe("hashDeviceToken", () => {
  const original = process.env.NEXTAUTH_SECRET;

  beforeEach(() => {
    process.env.NEXTAUTH_SECRET = TEST_SECRET;
  });

  afterEach(() => {
    if (original !== undefined) {
      process.env.NEXTAUTH_SECRET = original;
    } else {
      delete process.env.NEXTAUTH_SECRET;
    }
  });

  it("returns a hex string", () => {
    const hash = hashDeviceToken("test-token");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic for the same input", () => {
    const hash1 = hashDeviceToken("my-device-token");
    const hash2 = hashDeviceToken("my-device-token");
    expect(hash1).toBe(hash2);
  });

  it("produces different hashes for different tokens", () => {
    const hash1 = hashDeviceToken("token-a");
    const hash2 = hashDeviceToken("token-b");
    expect(hash1).not.toBe(hash2);
  });

  it("uses HMAC-SHA256 (not plain SHA-256)", () => {
    const token = "verify-hmac";
    const expected = crypto
      .createHmac("sha256", TEST_SECRET)
      .update(token)
      .digest("hex");
    expect(hashDeviceToken(token)).toBe(expected);

    // Confirm it does NOT match plain SHA-256
    const plainSha = crypto.createHash("sha256").update(token).digest("hex");
    expect(hashDeviceToken(token)).not.toBe(plainSha);
  });
});

describe("generateDeviceSecret", () => {
  it("starts with hs_dev_ prefix", () => {
    expect(generateDeviceSecret()).toMatch(/^hs_dev_/);
  });

  it("has 39 chars total (7 prefix + 32 hex)", () => {
    const secret = generateDeviceSecret();
    expect(secret).toHaveLength(39);
    expect(secret.slice(7)).toMatch(/^[0-9a-f]{32}$/);
  });

  it("generates unique secrets", () => {
    const secrets = new Set(Array.from({ length: 50 }, () => generateDeviceSecret()));
    expect(secrets.size).toBe(50);
  });
});

describe("redactKey", () => {
  it("redacts client key keeping prefix and last 4 chars", () => {
    const redacted = redactKey("hs_cli_abcdef1234567890");
    expect(redacted).toMatch(/^hs_cli_/);
    expect(redacted).toMatch(/7890$/);
    expect(redacted).toContain("••••••••");
  });

  it("redacts provider key", () => {
    const redacted = redactKey("hs_prov_abcdef1234567890");
    expect(redacted).toMatch(/^hs_prov_/);
    expect(redacted).toMatch(/7890$/);
  });

  it("redacts device key", () => {
    const redacted = redactKey("hs_dev_abcdef1234567890");
    expect(redacted).toMatch(/^hs_dev_/);
    expect(redacted).toMatch(/7890$/);
  });

  it("handles keys without recognized prefix", () => {
    const redacted = redactKey("unknown_key_value_1234");
    expect(redacted).toContain("••••••••");
    expect(redacted).toMatch(/1234$/);
  });
});

describe("isScopeAllowed", () => {
  it("full scope allows all methods", () => {
    expect(isScopeAllowed("full", "GET")).toBe(true);
    expect(isScopeAllowed("full", "POST")).toBe(true);
    expect(isScopeAllowed("full", "PUT")).toBe(true);
    expect(isScopeAllowed("full", "PATCH")).toBe(true);
    expect(isScopeAllowed("full", "DELETE")).toBe(true);
  });

  it("read scope allows only GET", () => {
    expect(isScopeAllowed("read", "GET")).toBe(true);
    expect(isScopeAllowed("read", "POST")).toBe(false);
    expect(isScopeAllowed("read", "PUT")).toBe(false);
    expect(isScopeAllowed("read", "DELETE")).toBe(false);
  });

  it("write scope allows POST/PUT/PATCH/DELETE but not GET", () => {
    expect(isScopeAllowed("write", "GET")).toBe(false);
    expect(isScopeAllowed("write", "POST")).toBe(true);
    expect(isScopeAllowed("write", "PUT")).toBe(true);
    expect(isScopeAllowed("write", "PATCH")).toBe(true);
    expect(isScopeAllowed("write", "DELETE")).toBe(true);
  });

  it("admin scope allows all methods", () => {
    expect(isScopeAllowed("admin", "GET")).toBe(true);
    expect(isScopeAllowed("admin", "POST")).toBe(true);
  });

  it("only admin scope allows key management", () => {
    expect(isScopeAllowed("admin", "POST", true)).toBe(true);
    expect(isScopeAllowed("full", "POST", true)).toBe(false);
    expect(isScopeAllowed("write", "POST", true)).toBe(false);
    expect(isScopeAllowed("read", "GET", true)).toBe(false);
  });

  it("unknown scope denies everything", () => {
    expect(isScopeAllowed("bogus", "GET")).toBe(false);
    expect(isScopeAllowed("bogus", "POST")).toBe(false);
    expect(isScopeAllowed("", "GET")).toBe(false);
  });
});

describe("sanitizeError", () => {
  it("redacts client key from error message", () => {
    const msg = sanitizeError(new Error("Invalid key hs_cli_abcdef1234567890abcdef1234567890"));
    expect(msg).not.toContain("abcdef1234567890abcdef1234567890");
    expect(msg).toContain("hs_cli_");
    expect(msg).toContain("••••••••");
  });

  it("redacts provider key from error message", () => {
    const msg = sanitizeError(new Error("Bad key: hs_prov_deadbeef12345678"));
    expect(msg).not.toContain("deadbeef12345678");
    expect(msg).toContain("hs_prov_");
  });

  it("redacts device key from error message", () => {
    const msg = sanitizeError("hs_dev_0000111122223333");
    expect(msg).not.toContain("0000111122223333");
    expect(msg).toContain("hs_dev_");
  });

  it("handles non-Error values", () => {
    expect(sanitizeError("plain string")).toBe("plain string");
    expect(sanitizeError(42)).toBe("42");
    expect(sanitizeError(null)).toBe("null");
  });

  it("leaves messages without keys untouched", () => {
    const msg = "Something went wrong";
    expect(sanitizeError(new Error(msg))).toBe(msg);
  });
});

// ── DB-dependent functions ──

describe("isKeyRateLimited", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns false on first request (no existing record)", async () => {
    vi.mocked(prisma.rateLimit.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.rateLimit.upsert).mockResolvedValue({} as any);

    const limited = await isKeyRateLimited("key_1", 60);
    expect(limited).toBe(false);
    expect(prisma.rateLimit.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { keyId: "key_1" },
        create: expect.objectContaining({ keyId: "key_1", count: 1 }),
      })
    );
  });

  it("returns false when window is expired (resets counter)", async () => {
    vi.mocked(prisma.rateLimit.findUnique).mockResolvedValue({
      keyId: "key_1",
      count: 999,
      resetAt: new Date(Date.now() - 1000), // expired
    } as any);
    vi.mocked(prisma.rateLimit.upsert).mockResolvedValue({} as any);

    const limited = await isKeyRateLimited("key_1", 60);
    expect(limited).toBe(false);
  });

  it("returns false when under the limit", async () => {
    vi.mocked(prisma.rateLimit.findUnique).mockResolvedValue({
      keyId: "key_1",
      count: 5,
      resetAt: new Date(Date.now() + 30_000), // active window
    } as any);
    vi.mocked(prisma.rateLimit.update).mockResolvedValue({
      keyId: "key_1",
      count: 6,
    } as any);

    const limited = await isKeyRateLimited("key_1", 60);
    expect(limited).toBe(false);
  });

  it("returns true when over the limit", async () => {
    vi.mocked(prisma.rateLimit.findUnique).mockResolvedValue({
      keyId: "key_1",
      count: 60,
      resetAt: new Date(Date.now() + 30_000),
    } as any);
    vi.mocked(prisma.rateLimit.update).mockResolvedValue({
      keyId: "key_1",
      count: 61,
    } as any);

    const limited = await isKeyRateLimited("key_1", 60);
    expect(limited).toBe(true);
  });
});

describe("validateApiKeyRequest", () => {
  const originalSecret = process.env.NEXTAUTH_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXTAUTH_SECRET = TEST_SECRET;
    // Default: no rate limiting
    vi.mocked(prisma.rateLimit.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.rateLimit.upsert).mockResolvedValue({} as any);
  });

  afterEach(() => {
    if (originalSecret !== undefined) {
      process.env.NEXTAUTH_SECRET = originalSecret;
    } else {
      delete process.env.NEXTAUTH_SECRET;
    }
  });

  it("returns 401 when x-api-key header is missing", async () => {
    const req = makeRequest({}, "GET");
    const result = await validateApiKeyRequest(req);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
    }
  });

  it("returns 401 when key is not found in DB", async () => {
    vi.mocked(prisma.apiKey.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.apiKey.findFirst).mockResolvedValue(null);

    const req = makeRequest({ "x-api-key": "hs_cli_nonexistent" }, "GET");
    const result = await validateApiKeyRequest(req);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
    }
  });

  it("returns 401 when key is inactive", async () => {
    vi.mocked(prisma.apiKey.findUnique).mockResolvedValue(
      makeKeyRecord({ isActive: false }) as any
    );

    const req = makeRequest({ "x-api-key": "hs_cli_abc123" }, "GET");
    const result = await validateApiKeyRequest(req);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
    }
  });

  it("succeeds with valid key and first IP (auto-binds)", async () => {
    vi.mocked(prisma.apiKey.findUnique).mockResolvedValue(makeKeyRecord() as any);
    vi.mocked(prisma.ipEvent.findMany).mockResolvedValue([]);
    vi.mocked(prisma.ipEvent.create).mockResolvedValue({} as any);

    const req = makeRequest(
      { "x-api-key": "hs_cli_abc123", "x-forwarded-for": "1.2.3.4" },
      "GET"
    );
    const result = await validateApiKeyRequest(req);
    expect(result.ok).toBe(true);
    expect(prisma.ipEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ ip: "1.2.3.4", status: "allowed" }),
      })
    );
  });

  it("returns 403 when IP is blacklisted", async () => {
    vi.mocked(prisma.apiKey.findUnique).mockResolvedValue(makeKeyRecord() as any);
    vi.mocked(prisma.ipEvent.findMany).mockResolvedValue([
      { id: "ip_1", ip: "1.2.3.4", status: "blacklisted", attempts: 20 },
    ] as any);

    const req = makeRequest(
      { "x-api-key": "hs_cli_abc123", "x-forwarded-for": "1.2.3.4" },
      "GET"
    );
    const result = await validateApiKeyRequest(req);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(403);
      const body = await result.response.json();
      expect(body.error).toContain("blacklisted");
    }
  });

  it("returns 403 when IP is pending", async () => {
    vi.mocked(prisma.apiKey.findUnique).mockResolvedValue(makeKeyRecord() as any);
    vi.mocked(prisma.ipEvent.findMany).mockResolvedValue([
      { id: "ip_1", ip: "5.6.7.8", status: "pending", attempts: 3 },
    ] as any);
    vi.mocked(prisma.ipEvent.update).mockResolvedValue({} as any);

    const req = makeRequest(
      { "x-api-key": "hs_cli_abc123", "x-forwarded-for": "5.6.7.8" },
      "GET"
    );
    const result = await validateApiKeyRequest(req);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(403);
    }
  });

  it("auto-blacklists after 20 pending attempts", async () => {
    vi.mocked(prisma.apiKey.findUnique).mockResolvedValue(makeKeyRecord() as any);
    vi.mocked(prisma.ipEvent.findMany).mockResolvedValue([
      { id: "ip_1", ip: "5.6.7.8", status: "pending", attempts: 19 },
    ] as any);
    vi.mocked(prisma.ipEvent.update).mockResolvedValue({} as any);

    const req = makeRequest(
      { "x-api-key": "hs_cli_abc123", "x-forwarded-for": "5.6.7.8" },
      "GET"
    );
    await validateApiKeyRequest(req);

    expect(prisma.ipEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "blacklisted" }),
      })
    );
  });

  it("returns 403 for unknown IP on existing key", async () => {
    vi.mocked(prisma.apiKey.findUnique).mockResolvedValue(makeKeyRecord() as any);
    vi.mocked(prisma.ipEvent.findMany).mockResolvedValue([
      { id: "ip_1", ip: "10.0.0.1", status: "allowed", attempts: 1 },
    ] as any);
    vi.mocked(prisma.ipEvent.upsert).mockResolvedValue({} as any);

    const req = makeRequest(
      { "x-api-key": "hs_cli_abc123", "x-forwarded-for": "99.99.99.99" },
      "GET"
    );
    const result = await validateApiKeyRequest(req);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(403);
      const body = await result.response.json();
      expect(body.error).toContain("not authorized");
    }
  });

  it("returns 403 when scope disallows the HTTP method", async () => {
    vi.mocked(prisma.apiKey.findUnique).mockResolvedValue(
      makeKeyRecord({ scope: "read" }) as any
    );
    vi.mocked(prisma.ipEvent.findMany).mockResolvedValue([
      { id: "ip_1", ip: "unknown", status: "allowed", attempts: 1 },
    ] as any);

    const req = makeRequest({ "x-api-key": "hs_cli_abc123" }, "POST");
    const result = await validateApiKeyRequest(req);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(403);
      const body = await result.response.json();
      expect(body.error).toContain("Scope");
    }
  });

  it("returns 403 when device token is required but missing", async () => {
    const hashedSecret = hashDeviceToken("correct-token");
    vi.mocked(prisma.apiKey.findUnique).mockResolvedValue(
      makeKeyRecord({ deviceSecret: hashedSecret }) as any
    );
    vi.mocked(prisma.ipEvent.findMany).mockResolvedValue([
      { id: "ip_1", ip: "unknown", status: "allowed", attempts: 1 },
    ] as any);

    const req = makeRequest({ "x-api-key": "hs_cli_abc123" }, "GET");
    const result = await validateApiKeyRequest(req);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(403);
      const body = await result.response.json();
      expect(body.error).toContain("device token");
    }
  });

  it("returns 403 when device token is wrong", async () => {
    const hashedSecret = hashDeviceToken("correct-token");
    vi.mocked(prisma.apiKey.findUnique).mockResolvedValue(
      makeKeyRecord({ deviceSecret: hashedSecret }) as any
    );
    vi.mocked(prisma.ipEvent.findMany).mockResolvedValue([
      { id: "ip_1", ip: "unknown", status: "allowed", attempts: 1 },
    ] as any);

    const req = makeRequest(
      { "x-api-key": "hs_cli_abc123", "x-device-token": "wrong-token" },
      "GET"
    );
    const result = await validateApiKeyRequest(req);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(403);
    }
  });

  it("succeeds with correct device token", async () => {
    const hashedSecret = hashDeviceToken("correct-token");
    vi.mocked(prisma.apiKey.findUnique).mockResolvedValue(
      makeKeyRecord({ deviceSecret: hashedSecret }) as any
    );
    vi.mocked(prisma.ipEvent.findMany).mockResolvedValue([
      { id: "ip_1", ip: "unknown", status: "allowed", attempts: 1 },
    ] as any);

    const req = makeRequest(
      { "x-api-key": "hs_cli_abc123", "x-device-token": "correct-token" },
      "GET"
    );
    const result = await validateApiKeyRequest(req);
    expect(result.ok).toBe(true);
  });

  it("returns 403 when machine ID mismatches", async () => {
    vi.mocked(prisma.apiKey.findUnique).mockResolvedValue(
      makeKeyRecord({ machineId: "machine-aaa" }) as any
    );
    vi.mocked(prisma.ipEvent.findMany).mockResolvedValue([
      { id: "ip_1", ip: "unknown", status: "allowed", attempts: 1 },
    ] as any);

    const req = makeRequest(
      { "x-api-key": "hs_cli_abc123", "x-machine-id": "machine-bbb" },
      "GET"
    );
    const result = await validateApiKeyRequest(req);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(403);
      const body = await result.response.json();
      expect(body.error).toContain("Machine fingerprint");
    }
  });

  it("binds machine ID on first use when not yet set", async () => {
    vi.mocked(prisma.apiKey.findUnique).mockResolvedValue(
      makeKeyRecord({ machineId: null }) as any
    );
    vi.mocked(prisma.ipEvent.findMany).mockResolvedValue([
      { id: "ip_1", ip: "unknown", status: "allowed", attempts: 1 },
    ] as any);
    vi.mocked(prisma.apiKey.update).mockResolvedValue({} as any);

    const req = makeRequest(
      { "x-api-key": "hs_cli_abc123", "x-machine-id": "new-machine" },
      "GET"
    );
    const result = await validateApiKeyRequest(req);
    expect(result.ok).toBe(true);
    expect(prisma.apiKey.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { machineId: "new-machine" },
      })
    );
  });

  it("returns 429 when rate limited", async () => {
    vi.mocked(prisma.apiKey.findUnique).mockResolvedValue(makeKeyRecord() as any);
    vi.mocked(prisma.ipEvent.findMany).mockResolvedValue([
      { id: "ip_1", ip: "unknown", status: "allowed", attempts: 1 },
    ] as any);
    // Override rate limit mock for this test
    vi.mocked(prisma.rateLimit.findUnique).mockResolvedValue({
      keyId: "key_1",
      count: 60,
      resetAt: new Date(Date.now() + 30_000),
    } as any);
    vi.mocked(prisma.rateLimit.update).mockResolvedValue({
      keyId: "key_1",
      count: 61,
    } as any);

    const req = makeRequest({ "x-api-key": "hs_cli_abc123" }, "GET");
    const result = await validateApiKeyRequest(req);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(429);
    }
  });

  it("supports key rotation via previousKeyHash within grace period", async () => {
    const oldKey = "hs_cli_old_key_value_1234";
    const hashedOldKey = crypto
      .createHmac("sha256", TEST_SECRET)
      .update(oldKey)
      .digest("hex");

    // Primary lookup fails
    vi.mocked(prisma.apiKey.findUnique).mockResolvedValue(null);
    // Rotation fallback succeeds
    vi.mocked(prisma.apiKey.findFirst).mockResolvedValue(
      makeKeyRecord({
        id: "key_rotated",
        previousKeyHash: hashedOldKey,
        previousKeyExpiresAt: new Date(Date.now() + 86_400_000),
      }) as any
    );
    vi.mocked(prisma.ipEvent.findMany).mockResolvedValue([]);
    vi.mocked(prisma.ipEvent.create).mockResolvedValue({} as any);

    const req = makeRequest({ "x-api-key": oldKey }, "GET");
    const result = await validateApiKeyRequest(req);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rotated).toBe(true);
    }
  });

  it("uses apiKeyOverride when provided", async () => {
    vi.mocked(prisma.apiKey.findUnique).mockResolvedValue(makeKeyRecord() as any);
    vi.mocked(prisma.ipEvent.findMany).mockResolvedValue([]);
    vi.mocked(prisma.ipEvent.create).mockResolvedValue({} as any);

    // No x-api-key header, but override provided
    const req = makeRequest({}, "GET");
    const result = await validateApiKeyRequest(req, {
      apiKeyOverride: "hs_cli_abc123",
    });
    expect(result.ok).toBe(true);
  });
});
