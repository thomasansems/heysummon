import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "node:crypto";

// Mock Prisma before imports
vi.mock("@/lib/prisma", () => ({
  prisma: {
    expertChannel: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    helpRequest: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    message: {
      create: vi.fn(),
    },
  },
}));

// Mock OpenClaw adapter functions
vi.mock("@/lib/adapters/openclaw", () => ({
  verifyWebhookSignature: vi.fn(),
  verifyQueryActionSignature: vi.fn(),
}));

vi.mock("@/services/notifications/acknowledge", () => ({
  acknowledgeNotification: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import {
  verifyWebhookSignature,
  verifyQueryActionSignature,
} from "@/lib/adapters/openclaw";
import { acknowledgeNotification } from "@/services/notifications/acknowledge";
import { POST } from "@/app/api/adapters/openclaw/[id]/webhook/route";
import { NextRequest } from "next/server";

const mockFindUnique = vi.mocked(prisma.expertChannel.findUnique);
const mockHelpRequestFindFirst = vi.mocked(prisma.helpRequest.findFirst);
const mockHelpRequestUpdate = vi.mocked(prisma.helpRequest.update);
const mockMessageCreate = vi.mocked(prisma.message.create);
const mockVerifySignature = vi.mocked(verifyWebhookSignature);
const mockVerifyQuerySignature = vi.mocked(verifyQueryActionSignature);
const mockAcknowledgeNotification = vi.mocked(acknowledgeNotification);

const webhookSecret = "test-webhook-secret";

const channelConfig = {
  apiKey: "oc_test_123",
  webhookUrl: "https://example.com/webhook",
  webhookSecret,
};

const mockChannel = {
  id: "ch-oc-1",
  type: "openclaw",
  isActive: true,
  config: JSON.stringify(channelConfig),
  profile: { userId: "user-1" },
};

function makeCallbackRequest(payload: unknown) {
  const body = JSON.stringify(payload);
  const signature = crypto.createHmac("sha256", webhookSecret).update(body).digest("hex");

  return new NextRequest("http://localhost/api/adapters/openclaw/ch-oc-1/webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-openclaw-signature": signature,
    },
    body,
  });
}

describe("OpenClaw webhook callback handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindUnique.mockResolvedValue(mockChannel as never);
    mockVerifySignature.mockReturnValue(true);
    mockVerifyQuerySignature.mockReturnValue(false);
  });

  it("handles approve action and updates help request", async () => {
    mockHelpRequestFindFirst.mockResolvedValue({
      id: "req-1",
      refCode: "HS-ABC1",
      expertId: "user-1",
      requiresApproval: true,
      approvalDecision: null,
      status: "pending",
    } as never);
    mockHelpRequestUpdate.mockResolvedValue({} as never);
    mockMessageCreate.mockResolvedValue({} as never);

    const res = await POST(
      makeCallbackRequest({ action: "approve", requestId: "req-1" }),
      { params: Promise.resolve({ id: "ch-oc-1" }) },
    );
    const json = await res.json();

    expect(json.ok).toBe(true);
    expect(json.decision).toBe("approved");
    expect(mockHelpRequestUpdate).toHaveBeenCalledWith({
      where: { id: "req-1" },
      data: expect.objectContaining({
        approvalDecision: "approved",
        status: "responded",
      }),
    });
    expect(mockMessageCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        requestId: "req-1",
        from: "expert",
        ciphertext: "approved",
      }),
    });
  });

  it("handles deny action and updates help request", async () => {
    mockHelpRequestFindFirst.mockResolvedValue({
      id: "req-2",
      refCode: "HS-XYZ2",
      expertId: "user-1",
      requiresApproval: true,
      approvalDecision: null,
      status: "pending",
    } as never);
    mockHelpRequestUpdate.mockResolvedValue({} as never);
    mockMessageCreate.mockResolvedValue({} as never);

    const res = await POST(
      makeCallbackRequest({ action: "deny", requestId: "req-2" }),
      { params: Promise.resolve({ id: "ch-oc-1" }) },
    );
    const json = await res.json();

    expect(json.ok).toBe(true);
    expect(json.decision).toBe("denied");
    expect(mockHelpRequestUpdate).toHaveBeenCalledWith({
      where: { id: "req-2" },
      data: expect.objectContaining({
        approvalDecision: "denied",
        status: "responded",
      }),
    });
  });

  it("prevents double-approval", async () => {
    mockHelpRequestFindFirst.mockResolvedValue({
      id: "req-3",
      refCode: "HS-DUP3",
      expertId: "user-1",
      requiresApproval: true,
      approvalDecision: "approved",
      status: "responded",
    } as never);

    const res = await POST(
      makeCallbackRequest({ action: "approve", requestId: "req-3" }),
      { params: Promise.resolve({ id: "ch-oc-1" }) },
    );
    const json = await res.json();

    expect(json.ok).toBe(true);
    expect(json.message).toContain("already approved");
    expect(mockHelpRequestUpdate).not.toHaveBeenCalled();
    expect(mockMessageCreate).not.toHaveBeenCalled();
  });

  it("rejects callback for expired requests", async () => {
    mockHelpRequestFindFirst.mockResolvedValue({
      id: "req-4",
      refCode: "HS-EXP4",
      expertId: "user-1",
      requiresApproval: true,
      approvalDecision: null,
      status: "expired",
    } as never);

    const res = await POST(
      makeCallbackRequest({ action: "approve", requestId: "req-4" }),
      { params: Promise.resolve({ id: "ch-oc-1" }) },
    );
    const json = await res.json();

    expect(json.ok).toBe(true);
    expect(json.message).toContain("expired");
    expect(mockHelpRequestUpdate).not.toHaveBeenCalled();
  });

  it("returns 404 for request not found", async () => {
    mockHelpRequestFindFirst.mockResolvedValue(null);

    const res = await POST(
      makeCallbackRequest({ action: "approve", requestId: "nonexistent" }),
      { params: Promise.resolve({ id: "ch-oc-1" }) },
    );

    expect(res.status).toBe(404);
    expect(mockHelpRequestUpdate).not.toHaveBeenCalled();
  });

  it("handles reply action", async () => {
    mockHelpRequestFindFirst.mockResolvedValue({
      id: "req-5",
      refCode: "HS-RPL5",
      expertId: "user-1",
      status: "pending",
    } as never);
    mockHelpRequestUpdate.mockResolvedValue({} as never);
    mockMessageCreate.mockResolvedValue({} as never);

    const res = await POST(
      makeCallbackRequest({ action: "reply", requestId: "req-5", message: "Here is my answer" }),
      { params: Promise.resolve({ id: "ch-oc-1" }) },
    );
    const json = await res.json();

    expect(json.ok).toBe(true);
    expect(mockHelpRequestUpdate).toHaveBeenCalledWith({
      where: { id: "req-5" },
      data: expect.objectContaining({
        response: "Here is my answer",
        status: "responded",
      }),
    });
    expect(mockMessageCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        requestId: "req-5",
        from: "expert",
        ciphertext: expect.stringContaining("plaintext:"),
      }),
    });
  });

  it("rejects reply without message", async () => {
    const res = await POST(
      makeCallbackRequest({ action: "reply", requestId: "req-5", message: "" }),
      { params: Promise.resolve({ id: "ch-oc-1" }) },
    );

    expect(res.status).toBe(400);
  });

  it("rejects invalid signature", async () => {
    mockVerifySignature.mockReturnValue(false);

    const req = new NextRequest("http://localhost/api/adapters/openclaw/ch-oc-1/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-openclaw-signature": "invalid",
      },
      body: JSON.stringify({ action: "approve", requestId: "req-1" }),
    });

    const res = await POST(
      req,
      { params: Promise.resolve({ id: "ch-oc-1" }) },
    );

    expect(res.status).toBe(403);
    expect(mockHelpRequestFindFirst).not.toHaveBeenCalled();
  });

  it("returns 404 for inactive channel", async () => {
    mockFindUnique.mockResolvedValue({
      ...mockChannel,
      isActive: false,
    } as never);

    const res = await POST(
      makeCallbackRequest({ action: "approve", requestId: "req-1" }),
      { params: Promise.resolve({ id: "ch-oc-1" }) },
    );

    expect(res.status).toBe(404);
  });

  it("returns 404 for non-openclaw channel type", async () => {
    mockFindUnique.mockResolvedValue({
      ...mockChannel,
      type: "telegram",
    } as never);

    const res = await POST(
      makeCallbackRequest({ action: "approve", requestId: "req-1" }),
      { params: Promise.resolve({ id: "ch-oc-1" }) },
    );

    expect(res.status).toBe(404);
  });

  it("rejects invalid JSON body", async () => {
    mockVerifySignature.mockReturnValue(true);

    const req = new NextRequest("http://localhost/api/adapters/openclaw/ch-oc-1/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-openclaw-signature": "sig",
      },
      body: "not json",
    });

    const res = await POST(
      req,
      { params: Promise.resolve({ id: "ch-oc-1" }) },
    );

    expect(res.status).toBe(400);
  });

  it("rejects invalid payload schema", async () => {
    mockVerifySignature.mockReturnValue(true);

    const res = await POST(
      makeCallbackRequest({ action: "unknown", requestId: "req-1" }),
      { params: Promise.resolve({ id: "ch-oc-1" }) },
    );

    expect(res.status).toBe(400);
  });

  describe("ack notification action", () => {
    it("routes ack body callbacks through the shared service", async () => {
      const ackedAt = new Date("2026-04-23T08:00:00.000Z");
      mockAcknowledgeNotification.mockResolvedValue({
        ok: true,
        status: "acknowledged",
        acknowledgedAt: ackedAt,
        alreadyAcknowledged: false,
      });

      const res = await POST(
        makeCallbackRequest({ action: "ack", requestId: "req-ntf-1" }),
        { params: Promise.resolve({ id: "ch-oc-1" }) },
      );
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json).toEqual({
        ok: true,
        status: "acknowledged",
        acknowledgedAt: ackedAt.toISOString(),
        alreadyAcknowledged: false,
      });
      expect(mockAcknowledgeNotification).toHaveBeenCalledWith({
        requestId: "req-ntf-1",
        expertUserId: "user-1",
        source: "openclaw",
      });
      // Ack must NOT touch the help-mode tables.
      expect(mockHelpRequestFindFirst).not.toHaveBeenCalled();
      expect(mockHelpRequestUpdate).not.toHaveBeenCalled();
      expect(mockMessageCreate).not.toHaveBeenCalled();
    });

    it("reports alreadyAcknowledged on idempotent ack", async () => {
      const ackedAt = new Date("2026-04-23T08:01:00.000Z");
      mockAcknowledgeNotification.mockResolvedValue({
        ok: true,
        status: "acknowledged",
        acknowledgedAt: ackedAt,
        alreadyAcknowledged: true,
      });

      const res = await POST(
        makeCallbackRequest({ action: "ack", requestId: "req-ntf-2" }),
        { params: Promise.resolve({ id: "ch-oc-1" }) },
      );
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.alreadyAcknowledged).toBe(true);
    });

    it("returns 409 when service rejects with NOT_APPLICABLE", async () => {
      mockAcknowledgeNotification.mockResolvedValue({
        ok: false,
        code: "NOT_APPLICABLE",
        message: "This request expects a reply; use /close to end the conversation",
      });

      const res = await POST(
        makeCallbackRequest({ action: "ack", requestId: "req-help" }),
        { params: Promise.resolve({ id: "ch-oc-1" }) },
      );
      const json = await res.json();

      expect(res.status).toBe(409);
      expect(json).toMatchObject({ ok: false, code: "NOT_APPLICABLE" });
    });

    it("returns 404 when service reports NOT_FOUND", async () => {
      mockAcknowledgeNotification.mockResolvedValue({
        ok: false,
        code: "NOT_FOUND",
        message: "Request not found",
      });

      const res = await POST(
        makeCallbackRequest({ action: "ack", requestId: "missing" }),
        { params: Promise.resolve({ id: "ch-oc-1" }) },
      );
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json).toMatchObject({ ok: false, code: "NOT_FOUND" });
    });

    it("routes signed query-param ack URLs to the shared service", async () => {
      const ackedAt = new Date("2026-04-23T08:02:00.000Z");
      mockAcknowledgeNotification.mockResolvedValue({
        ok: true,
        status: "acknowledged",
        acknowledgedAt: ackedAt,
        alreadyAcknowledged: false,
      });
      // Body-signature path fails so the route falls through to query-param handling.
      mockVerifySignature.mockReturnValue(false);
      mockVerifyQuerySignature.mockReturnValue(true);

      const req = new NextRequest(
        "http://localhost/api/adapters/openclaw/ch-oc-1/webhook?action=ack&requestId=req-ntf-3&sig=valid",
        { method: "POST", body: "" },
      );

      const res = await POST(req, { params: Promise.resolve({ id: "ch-oc-1" }) });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.status).toBe("acknowledged");
      expect(mockVerifyQuerySignature).toHaveBeenCalledWith(
        webhookSecret,
        "ack",
        "req-ntf-3",
        "valid",
      );
      expect(mockAcknowledgeNotification).toHaveBeenCalledWith({
        requestId: "req-ntf-3",
        expertUserId: "user-1",
        source: "openclaw",
      });
    });

    it("rejects unsigned query-param ack URLs", async () => {
      mockVerifySignature.mockReturnValue(false);
      mockVerifyQuerySignature.mockReturnValue(false);

      const req = new NextRequest(
        "http://localhost/api/adapters/openclaw/ch-oc-1/webhook?action=ack&requestId=req-ntf-4&sig=forged",
        { method: "POST", body: "" },
      );

      const res = await POST(req, { params: Promise.resolve({ id: "ch-oc-1" }) });

      expect(res.status).toBe(403);
      expect(mockAcknowledgeNotification).not.toHaveBeenCalled();
    });
  });
});
