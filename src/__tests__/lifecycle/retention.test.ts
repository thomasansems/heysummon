import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock dependencies before imports
vi.mock("@/lib/prisma", () => ({
  prisma: {
    helpRequest: {
      deleteMany: vi.fn(),
    },
    auditLog: {
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/gdpr", () => ({
  getGdprSettings: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { getGdprSettings } from "@/lib/gdpr";
import { runCleanup } from "@/lib/retention";

const mockDeleteRequests = vi.mocked(prisma.helpRequest.deleteMany);
const mockDeleteAuditLogs = vi.mocked(prisma.auditLog.deleteMany);
const mockGetGdprSettings = vi.mocked(getGdprSettings);

describe("retention", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T00:00:00Z"));

    mockDeleteRequests.mockResolvedValue({ count: 0 });
    mockDeleteAuditLogs.mockResolvedValue({ count: 0 });
  });

  afterEach(() => {
    vi.useRealTimers();
    // Reset the env var
    delete process.env.HEYSUMMON_RETENTION_DAYS;
  });

  it("does nothing when no retention policy is configured", async () => {
    delete process.env.HEYSUMMON_RETENTION_DAYS;
    mockGetGdprSettings.mockResolvedValue({
      enabled: false,
      anonymizeIps: true,
      retentionDays: 90,
      requireConsent: true,
      allowDataExport: true,
      allowDataDeletion: true,
      privacyPolicyUrl: null,
    });

    await runCleanup();

    expect(mockDeleteRequests).not.toHaveBeenCalled();
    expect(mockDeleteAuditLogs).not.toHaveBeenCalled();
  });

  it("uses GDPR retention days when GDPR is enabled", async () => {
    mockGetGdprSettings.mockResolvedValue({
      enabled: true,
      anonymizeIps: true,
      retentionDays: 30,
      requireConsent: true,
      allowDataExport: true,
      allowDataDeletion: true,
      privacyPolicyUrl: null,
    });

    await runCleanup();

    // Should calculate cutoff as 30 days before now
    const expectedCutoff = new Date("2026-05-16T00:00:00Z");
    expect(mockDeleteRequests).toHaveBeenCalledWith({
      where: {
        status: { in: ["expired", "closed"] },
        updatedAt: { lt: expectedCutoff },
      },
    });
    expect(mockDeleteAuditLogs).toHaveBeenCalledWith({
      where: {
        createdAt: { lt: expectedCutoff },
      },
    });
  });

  it("deletes expired/closed requests and old audit logs", async () => {
    mockGetGdprSettings.mockResolvedValue({
      enabled: true,
      anonymizeIps: true,
      retentionDays: 90,
      requireConsent: true,
      allowDataExport: true,
      allowDataDeletion: true,
      privacyPolicyUrl: null,
    });

    mockDeleteRequests.mockResolvedValue({ count: 5 });
    mockDeleteAuditLogs.mockResolvedValue({ count: 12 });

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await runCleanup();

    expect(mockDeleteRequests).toHaveBeenCalled();
    expect(mockDeleteAuditLogs).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("removed 5 request(s), 12 audit log(s)")
    );
    consoleSpy.mockRestore();
  });

  it("does not log when nothing is deleted", async () => {
    mockGetGdprSettings.mockResolvedValue({
      enabled: true,
      anonymizeIps: true,
      retentionDays: 90,
      requireConsent: true,
      allowDataExport: true,
      allowDataDeletion: true,
      privacyPolicyUrl: null,
    });

    mockDeleteRequests.mockResolvedValue({ count: 0 });
    mockDeleteAuditLogs.mockResolvedValue({ count: 0 });

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await runCleanup();

    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("handles database errors gracefully", async () => {
    mockGetGdprSettings.mockResolvedValue({
      enabled: true,
      anonymizeIps: true,
      retentionDays: 90,
      requireConsent: true,
      allowDataExport: true,
      allowDataDeletion: true,
      privacyPolicyUrl: null,
    });

    mockDeleteRequests.mockRejectedValue(new Error("db connection lost"));

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(runCleanup()).resolves.toBeUndefined();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Cleanup failed: db connection lost")
    );
    consoleSpy.mockRestore();
  });

  it("calculates correct cutoff date for boundary retention period", async () => {
    mockGetGdprSettings.mockResolvedValue({
      enabled: true,
      anonymizeIps: true,
      retentionDays: 1,
      requireConsent: true,
      allowDataExport: true,
      allowDataDeletion: true,
      privacyPolicyUrl: null,
    });

    await runCleanup();

    const expectedCutoff = new Date("2026-06-14T00:00:00Z"); // 1 day before
    expect(mockDeleteRequests).toHaveBeenCalledWith({
      where: {
        status: { in: ["expired", "closed"] },
        updatedAt: { lt: expectedCutoff },
      },
    });
  });
});
