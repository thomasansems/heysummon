import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  hashDeviceToken,
  generateDeviceSecret,
  redactKey,
  isScopeAllowed,
  isKeyRateLimited,
  sanitizeError,
} from "@/lib/api-key-auth";

// Mock Prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    rateLimit: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";

const mockFindUnique = vi.mocked(prisma.rateLimit.findUnique);
const mockUpsert = vi.mocked(prisma.rateLimit.upsert);
const mockUpdate = vi.mocked(prisma.rateLimit.update);

describe("api-key-auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("hashDeviceToken", () => {
    it("returns a deterministic hex hash", () => {
      const hash1 = hashDeviceToken("test-token");
      const hash2 = hashDeviceToken("test-token");
      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    });

    it("returns different hashes for different tokens", () => {
      const hash1 = hashDeviceToken("token-a");
      const hash2 = hashDeviceToken("token-b");
      expect(hash1).not.toBe(hash2);
    });
  });

  describe("generateDeviceSecret", () => {
    it("returns a string with hs_dev_ prefix", () => {
      const secret = generateDeviceSecret();
      expect(secret).toMatch(/^hs_dev_[a-f0-9]{32}$/);
    });

    it("generates unique secrets", () => {
      const a = generateDeviceSecret();
      const b = generateDeviceSecret();
      expect(a).not.toBe(b);
    });
  });

  describe("redactKey", () => {
    it("redacts a CLI key keeping prefix and last 4 chars", () => {
      const redacted = redactKey("hs_cli_abcdef1234567890");
      expect(redacted).toMatch(/^hs_cli_/);
      expect(redacted).toMatch(/7890$/);
      expect(redacted).toContain("\u2022".repeat(8));
    });

    it("redacts an expert key", () => {
      const redacted = redactKey("hs_exp_abcdef1234567890");
      expect(redacted).toMatch(/^hs_exp_/);
      expect(redacted).toMatch(/7890$/);
    });

    it("handles short keys gracefully", () => {
      const redacted = redactKey("short");
      expect(redacted).toContain("\u2022");
    });
  });

  describe("isScopeAllowed", () => {
    it("full scope allows all methods", () => {
      expect(isScopeAllowed("full", "GET")).toBe(true);
      expect(isScopeAllowed("full", "POST")).toBe(true);
      expect(isScopeAllowed("full", "DELETE")).toBe(true);
    });

    it("read scope allows only GET", () => {
      expect(isScopeAllowed("read", "GET")).toBe(true);
      expect(isScopeAllowed("read", "POST")).toBe(false);
      expect(isScopeAllowed("read", "DELETE")).toBe(false);
    });

    it("write scope allows mutating methods", () => {
      expect(isScopeAllowed("write", "POST")).toBe(true);
      expect(isScopeAllowed("write", "PUT")).toBe(true);
      expect(isScopeAllowed("write", "PATCH")).toBe(true);
      expect(isScopeAllowed("write", "DELETE")).toBe(true);
      expect(isScopeAllowed("write", "GET")).toBe(false);
    });

    it("admin scope allows everything including key management", () => {
      expect(isScopeAllowed("admin", "GET")).toBe(true);
      expect(isScopeAllowed("admin", "POST", true)).toBe(true);
    });

    it("only admin allows key management", () => {
      expect(isScopeAllowed("full", "POST", true)).toBe(false);
      expect(isScopeAllowed("read", "GET", true)).toBe(false);
      expect(isScopeAllowed("write", "POST", true)).toBe(false);
    });

    it("unknown scope denies everything", () => {
      expect(isScopeAllowed("unknown", "GET")).toBe(false);
      expect(isScopeAllowed("unknown", "POST")).toBe(false);
    });
  });

  describe("sanitizeError", () => {
    it("redacts API key patterns in error messages", () => {
      const result = sanitizeError(
        new Error("Key hs_cli_abcdef1234567890 is invalid")
      );
      expect(result).not.toContain("abcdef1234567890");
      expect(result).toContain("\u2022");
    });

    it("handles non-Error values", () => {
      const result = sanitizeError("string error with hs_dev_abcdef1234567890");
      expect(result).not.toContain("abcdef1234567890");
    });

    it("passes through messages without keys", () => {
      const result = sanitizeError(new Error("Something broke"));
      expect(result).toBe("Something broke");
    });
  });

  describe("isKeyRateLimited", () => {
    const KEY_ID = "test-key-id";
    const MAX_PER_MINUTE = 10;

    it("returns false and creates a fresh window when no existing record", async () => {
      mockFindUnique.mockResolvedValue(null);
      mockUpsert.mockResolvedValue({} as never);

      const result = await isKeyRateLimited(KEY_ID, MAX_PER_MINUTE);

      expect(result).toBe(false);
      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { keyId: KEY_ID },
      });
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { keyId: KEY_ID },
          create: expect.objectContaining({ keyId: KEY_ID, count: 1 }),
          update: expect.objectContaining({ count: 1 }),
        })
      );
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("returns false and resets window when existing record has expired", async () => {
      const expiredRecord = {
        keyId: KEY_ID,
        count: 999,
        resetAt: new Date(Date.now() - 120_000), // 2 minutes ago
      };
      mockFindUnique.mockResolvedValue(expiredRecord as never);
      mockUpsert.mockResolvedValue({} as never);

      const result = await isKeyRateLimited(KEY_ID, MAX_PER_MINUTE);

      expect(result).toBe(false);
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { keyId: KEY_ID },
          update: expect.objectContaining({ count: 1 }),
        })
      );
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("returns false when within window and under the limit", async () => {
      const activeRecord = {
        keyId: KEY_ID,
        count: 5,
        resetAt: new Date(Date.now() + 30_000), // 30s from now
      };
      mockFindUnique.mockResolvedValue(activeRecord as never);
      mockUpdate.mockResolvedValue({ count: 6 } as never);

      const result = await isKeyRateLimited(KEY_ID, MAX_PER_MINUTE);

      expect(result).toBe(false);
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { keyId: KEY_ID },
        data: { count: { increment: 1 } },
      });
      expect(mockUpsert).not.toHaveBeenCalled();
    });

    it("returns false when count equals the limit (boundary)", async () => {
      const activeRecord = {
        keyId: KEY_ID,
        count: 9,
        resetAt: new Date(Date.now() + 30_000),
      };
      mockFindUnique.mockResolvedValue(activeRecord as never);
      // After increment: count = 10, which equals maxPerMinute (10)
      mockUpdate.mockResolvedValue({ count: 10 } as never);

      const result = await isKeyRateLimited(KEY_ID, MAX_PER_MINUTE);

      expect(result).toBe(false); // 10 > 10 is false
    });

    it("returns true when count exceeds the limit", async () => {
      const activeRecord = {
        keyId: KEY_ID,
        count: 10,
        resetAt: new Date(Date.now() + 30_000),
      };
      mockFindUnique.mockResolvedValue(activeRecord as never);
      // After increment: count = 11, which exceeds maxPerMinute (10)
      mockUpdate.mockResolvedValue({ count: 11 } as never);

      const result = await isKeyRateLimited(KEY_ID, MAX_PER_MINUTE);

      expect(result).toBe(true);
    });

    it("handles maxPerMinute of 1 correctly", async () => {
      const activeRecord = {
        keyId: KEY_ID,
        count: 1,
        resetAt: new Date(Date.now() + 30_000),
      };
      mockFindUnique.mockResolvedValue(activeRecord as never);
      mockUpdate.mockResolvedValue({ count: 2 } as never);

      const result = await isKeyRateLimited(KEY_ID, 1);

      expect(result).toBe(true); // 2 > 1
    });

    it("first request in a new window always passes", async () => {
      mockFindUnique.mockResolvedValue(null);
      mockUpsert.mockResolvedValue({} as never);

      // Even with maxPerMinute = 1, the very first request should pass
      const result = await isKeyRateLimited(KEY_ID, 1);

      expect(result).toBe(false);
    });
  });
});
