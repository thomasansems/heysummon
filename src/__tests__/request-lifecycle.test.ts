import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  transitionRequest,
  StaleStateError,
  InvalidTransitionError,
  isValidTransition,
} from "@/lib/request-lifecycle";

// Mock Prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    helpRequest: {
      updateMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// Mock audit logging
vi.mock("@/lib/audit", () => ({
  logAuditEvent: vi.fn(),
  AuditEventTypes: {
    STATE_TRANSITION: "STATE_TRANSITION",
  },
}));

import { prisma } from "@/lib/prisma";
import { logAuditEvent } from "@/lib/audit";

const mockUpdateMany = vi.mocked(prisma.helpRequest.updateMany);
const mockFindUnique = vi.mocked(prisma.helpRequest.findUnique);
const mockUpdate = vi.mocked(prisma.helpRequest.update);
const mockLogAudit = vi.mocked(logAuditEvent);

describe("request-lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("isValidTransition", () => {
    it("allows pending → active", () => {
      expect(isValidTransition("pending", "active")).toBe(true);
    });

    it("allows pending → expired", () => {
      expect(isValidTransition("pending", "expired")).toBe(true);
    });

    it("allows pending → closed", () => {
      expect(isValidTransition("pending", "closed")).toBe(true);
    });

    it("allows active → responded", () => {
      expect(isValidTransition("active", "responded")).toBe(true);
    });

    it("allows active → expired", () => {
      expect(isValidTransition("active", "expired")).toBe(true);
    });

    it("allows active → closed", () => {
      expect(isValidTransition("active", "closed")).toBe(true);
    });

    it("allows responded → closed", () => {
      expect(isValidTransition("responded", "closed")).toBe(true);
    });

    it("rejects closed → pending", () => {
      expect(isValidTransition("closed", "pending")).toBe(false);
    });

    it("rejects expired → pending", () => {
      expect(isValidTransition("expired", "pending")).toBe(false);
    });

    it("rejects responded → active", () => {
      expect(isValidTransition("responded", "active")).toBe(false);
    });

    it("rejects pending → responded (must go through active)", () => {
      expect(isValidTransition("pending", "responded")).toBe(false);
    });
  });

  describe("transitionRequest", () => {
    it("transitions successfully and returns result", async () => {
      mockUpdateMany.mockResolvedValue({ count: 1 });
      mockFindUnique.mockResolvedValue(null);

      const result = await transitionRequest("req-1", "pending", "active");

      expect(result).toEqual({
        requestId: "req-1",
        previousStatus: "pending",
        newStatus: "active",
      });
    });

    it("passes optimistic concurrency WHERE clause", async () => {
      mockUpdateMany.mockResolvedValue({ count: 1 });

      await transitionRequest("req-1", "pending", "closed");

      expect(mockUpdateMany).toHaveBeenCalledWith({
        where: { id: "req-1", status: "pending" },
        data: expect.objectContaining({ status: "closed" }),
      });
    });

    it("throws StaleStateError when 0 rows updated (concurrent transition)", async () => {
      mockUpdateMany.mockResolvedValue({ count: 0 });

      await expect(
        transitionRequest("req-1", "pending", "active")
      ).rejects.toThrow(StaleStateError);
    });

    it("throws InvalidTransitionError for illegal transitions", async () => {
      await expect(
        transitionRequest("req-1", "closed", "pending")
      ).rejects.toThrow(InvalidTransitionError);

      // Prisma should never be called for invalid transitions
      expect(mockUpdateMany).not.toHaveBeenCalled();
    });

    it("auto-computes closedAt when transitioning to closed", async () => {
      mockUpdateMany.mockResolvedValue({ count: 1 });

      await transitionRequest("req-1", "responded", "closed");

      expect(mockUpdateMany).toHaveBeenCalledWith({
        where: { id: "req-1", status: "responded" },
        data: expect.objectContaining({
          status: "closed",
          closedAt: expect.any(Date),
        }),
      });
    });

    it("auto-computes respondedAt when transitioning to responded", async () => {
      mockUpdateMany.mockResolvedValue({ count: 1 });
      mockFindUnique.mockResolvedValue({
        createdAt: new Date(Date.now() - 5000),
      } as never);
      mockUpdate.mockResolvedValue({} as never);

      await transitionRequest("req-1", "active", "responded");

      expect(mockUpdateMany).toHaveBeenCalledWith({
        where: { id: "req-1", status: "active" },
        data: expect.objectContaining({
          status: "responded",
          respondedAt: expect.any(Date),
        }),
      });
    });

    it("logs STATE_TRANSITION audit event", async () => {
      mockUpdateMany.mockResolvedValue({ count: 1 });

      await transitionRequest("req-1", "pending", "closed", {
        actor: "user-123",
        extra: { refCode: "HS-ABC" },
      });

      expect(mockLogAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "STATE_TRANSITION",
          userId: "user-123",
          success: true,
          metadata: expect.objectContaining({
            requestId: "req-1",
            from: "pending",
            to: "closed",
            refCode: "HS-ABC",
          }),
        })
      );
    });

    it("passes request object for IP/UA extraction in audit", async () => {
      mockUpdateMany.mockResolvedValue({ count: 1 });

      const mockRequest = { headers: new Headers({ "x-forwarded-for": "1.2.3.4" }) };

      await transitionRequest("req-1", "pending", "expired", {
        request: mockRequest,
      });

      expect(mockLogAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          request: mockRequest,
        })
      );
    });
  });
});
