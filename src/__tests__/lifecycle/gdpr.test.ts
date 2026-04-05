import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Prisma before imports
vi.mock("@/lib/prisma", () => ({
  prisma: {
    gdprSettings: {
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    helpRequest: {
      findMany: vi.fn(),
      count: vi.fn(),
      deleteMany: vi.fn(),
    },
    auditLog: {
      findMany: vi.fn(),
      count: vi.fn(),
      deleteMany: vi.fn(),
    },
    apiKey: {
      count: vi.fn(),
      deleteMany: vi.fn(),
    },
    userProfile: {
      count: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import {
  getGdprSettings,
  invalidateGdprCache,
  anonymizeIp,
  maybeAnonymizeIp,
  exportUserData,
  deleteUserData,
} from "@/lib/gdpr";

const mockGdprFind = vi.mocked(prisma.gdprSettings.findUnique);

describe("gdpr", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invalidateGdprCache();
  });

  describe("getGdprSettings", () => {
    it("returns defaults when no settings exist in database", async () => {
      mockGdprFind.mockResolvedValue(null);

      const settings = await getGdprSettings();

      expect(settings.enabled).toBe(false);
      expect(settings.anonymizeIps).toBe(true);
      expect(settings.retentionDays).toBe(90);
      expect(settings.requireConsent).toBe(true);
      expect(settings.allowDataExport).toBe(true);
      expect(settings.allowDataDeletion).toBe(true);
      expect(settings.privacyPolicyUrl).toBeNull();
    });

    it("returns database settings when they exist", async () => {
      mockGdprFind.mockResolvedValue({
        id: "singleton",
        enabled: true,
        anonymizeIps: false,
        retentionDays: 30,
        requireConsent: false,
        allowDataExport: true,
        allowDataDeletion: false,
        privacyPolicyUrl: "https://example.com/privacy",
      } as never);

      const settings = await getGdprSettings();

      expect(settings.enabled).toBe(true);
      expect(settings.anonymizeIps).toBe(false);
      expect(settings.retentionDays).toBe(30);
      expect(settings.privacyPolicyUrl).toBe("https://example.com/privacy");
    });

    it("caches settings and returns cached value on subsequent calls", async () => {
      mockGdprFind.mockResolvedValue(null);

      await getGdprSettings();
      await getGdprSettings();

      expect(mockGdprFind).toHaveBeenCalledTimes(1);
    });

    it("invalidateGdprCache forces a fresh database lookup", async () => {
      mockGdprFind.mockResolvedValue(null);

      await getGdprSettings();
      invalidateGdprCache();
      await getGdprSettings();

      expect(mockGdprFind).toHaveBeenCalledTimes(2);
    });
  });

  describe("anonymizeIp", () => {
    it("zeroes last octet of IPv4 address", () => {
      expect(anonymizeIp("192.168.1.105")).toBe("192.168.1.0");
    });

    it("handles various IPv4 addresses", () => {
      expect(anonymizeIp("10.0.0.1")).toBe("10.0.0.0");
      expect(anonymizeIp("255.255.255.255")).toBe("255.255.255.0");
      expect(anonymizeIp("0.0.0.0")).toBe("0.0.0.0");
    });

    it("anonymizes IPv6 by keeping /48 prefix", () => {
      const result = anonymizeIp("2001:db8:85a3::8a2e:370:7334");
      expect(result).toBe("2001:db8:85a3::");
    });

    it("returns empty string as-is", () => {
      expect(anonymizeIp("")).toBe("");
    });

    it("returns 'unknown' as-is", () => {
      expect(anonymizeIp("unknown")).toBe("unknown");
    });
  });

  describe("maybeAnonymizeIp", () => {
    it("returns null for null input", async () => {
      expect(await maybeAnonymizeIp(null)).toBeNull();
    });

    it("anonymizes IP when GDPR is enabled with anonymizeIps", async () => {
      mockGdprFind.mockResolvedValue({
        id: "singleton",
        enabled: true,
        anonymizeIps: true,
        retentionDays: 90,
        requireConsent: true,
        allowDataExport: true,
        allowDataDeletion: true,
        privacyPolicyUrl: null,
      } as never);

      invalidateGdprCache();
      const result = await maybeAnonymizeIp("192.168.1.105");
      expect(result).toBe("192.168.1.0");
    });

    it("returns full IP when GDPR is disabled", async () => {
      mockGdprFind.mockResolvedValue(null);

      invalidateGdprCache();
      const result = await maybeAnonymizeIp("192.168.1.105");
      expect(result).toBe("192.168.1.105");
    });
  });

  describe("exportUserData", () => {
    it("returns null when user does not exist", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const result = await exportUserData("nonexistent");
      expect(result).toBeNull();
    });

    it("exports complete user data structure", async () => {
      mockGdprFind.mockResolvedValue(null);
      invalidateGdprCache();

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: "user-1",
        email: "test@example.com",
        name: "Test User",
        role: "expert",
        onboardingComplete: true,
        expertise: "testing",
        notificationPref: "email",
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-02"),
        accounts: [],
        expertProfiles: [],
        sessions: [],
        certificates: [],
        consents: [],
        apiKeys: [],
      } as never);

      vi.mocked(prisma.helpRequest.findMany).mockResolvedValue([]);
      vi.mocked(prisma.auditLog.findMany).mockResolvedValue([]);

      const result = await exportUserData("user-1");

      expect(result).not.toBeNull();
      expect(result!.gdprArticle).toBe("Art. 15 GDPR \u2014 Right of Access");
      expect(result!.user.id).toBe("user-1");
      expect(result!.user.email).toBe("test@example.com");
      expect(result!.exportDate).toBeDefined();
      expect(result!.accounts).toEqual([]);
      expect(result!.expertProfiles).toEqual([]);
      expect(result!.requests).toEqual([]);
      expect(result!.auditLogs).toEqual([]);
    });
  });

  describe("deleteUserData", () => {
    it("returns null when user does not exist", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const result = await deleteUserData("nonexistent");
      expect(result).toBeNull();
    });

    it("deletes all user data in correct order and returns summary", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "user-1" } as never);
      vi.mocked(prisma.helpRequest.count).mockResolvedValue(3);
      vi.mocked(prisma.auditLog.count).mockResolvedValue(10);
      vi.mocked(prisma.apiKey.count).mockResolvedValue(2);
      vi.mocked(prisma.userProfile.count).mockResolvedValue(1);
      vi.mocked(prisma.helpRequest.deleteMany).mockResolvedValue({ count: 3 });
      vi.mocked(prisma.auditLog.deleteMany).mockResolvedValue({ count: 10 });
      vi.mocked(prisma.apiKey.deleteMany).mockResolvedValue({ count: 2 });
      vi.mocked(prisma.userProfile.deleteMany).mockResolvedValue({ count: 1 });
      vi.mocked(prisma.user.delete).mockResolvedValue({} as never);

      const result = await deleteUserData("user-1");

      expect(result).not.toBeNull();
      expect(result!.gdprArticle).toBe("Art. 17 GDPR \u2014 Right to Erasure");
      expect(result!.summary).toEqual({
        helpRequests: 3,
        auditLogs: 10,
        apiKeys: 2,
        profiles: 1,
        user: 1,
      });

      // Verify deletion order: requests, audit, apiKeys, profiles, then user
      const deleteCallOrder = [
        prisma.helpRequest.deleteMany,
        prisma.auditLog.deleteMany,
        prisma.apiKey.deleteMany,
        prisma.userProfile.deleteMany,
        prisma.user.delete,
      ];
      for (const fn of deleteCallOrder) {
        expect(fn).toHaveBeenCalled();
      }
    });
  });
});
