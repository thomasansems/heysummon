import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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

// Mock Slack adapter functions
vi.mock("@/lib/adapters/slack", () => ({
  sendMessage: vi.fn(),
  updateMessage: vi.fn(),
  verifySlackSignature: vi.fn(),
}));

vi.mock("@/services/notifications/acknowledge", () => ({
  acknowledgeNotification: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { updateMessage, verifySlackSignature } from "@/lib/adapters/slack";
import { acknowledgeNotification } from "@/services/notifications/acknowledge";
import { POST } from "@/app/api/adapters/slack/[id]/webhook/route";
import { NextRequest } from "next/server";

const mockFindUnique = vi.mocked(prisma.expertChannel.findUnique);
const mockChannelUpdate = vi.mocked(prisma.expertChannel.update);
const mockHelpRequestFindFirst = vi.mocked(prisma.helpRequest.findFirst);
const mockHelpRequestUpdate = vi.mocked(prisma.helpRequest.update);
const mockMessageCreate = vi.mocked(prisma.message.create);
const mockUpdateMessage = vi.mocked(updateMessage);
const mockVerifySignature = vi.mocked(verifySlackSignature);
const mockAcknowledgeNotification = vi.mocked(acknowledgeNotification);

const channelConfig = {
  botToken: "xoxb-test-token",
  signingSecret: "test-signing-secret",
  channelId: "C0123456789",
};

const mockChannel = {
  id: "ch-slack-1",
  type: "slack",
  isActive: true,
  config: JSON.stringify(channelConfig),
  profile: { userId: "user-1" },
};

function makeInteractiveRequest(payload: unknown, signingSecret = "test-signing-secret") {
  const body = `payload=${encodeURIComponent(JSON.stringify(payload))}`;
  const timestamp = String(Math.floor(Date.now() / 1000));
  const baseString = `v0:${timestamp}:${body}`;
  const hmac = crypto.createHmac("sha256", signingSecret).update(baseString).digest("hex");
  const signature = `v0=${hmac}`;

  return new NextRequest("http://localhost/api/adapters/slack/ch-slack-1/webhook", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-slack-request-timestamp": timestamp,
      "x-slack-signature": signature,
    },
    body,
  });
}

function makeApprovePayload(requestId: string, actionId = "approve_request") {
  return {
    type: "block_actions",
    user: { id: "U0123", username: "testuser" },
    actions: [{ action_id: actionId, value: requestId }],
    channel: { id: "C0123456789" },
    message: { ts: "1234567890.123456", text: "Approval required" },
  };
}

describe("Slack webhook block_actions handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindUnique.mockResolvedValue(mockChannel as never);
    mockChannelUpdate.mockResolvedValue({} as never);
    mockUpdateMessage.mockResolvedValue(undefined);
    mockVerifySignature.mockReturnValue(true);
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
      makeInteractiveRequest(makeApprovePayload("req-1")),
      { params: Promise.resolve({ id: "ch-slack-1" }) },
    );
    const json = await res.json();

    expect(json).toEqual({ ok: true });
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
    expect(mockUpdateMessage).toHaveBeenCalledWith(
      "xoxb-test-token",
      "C0123456789",
      "1234567890.123456",
      expect.stringContaining("Approved"),
    );
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
      makeInteractiveRequest(makeApprovePayload("req-2", "deny_request")),
      { params: Promise.resolve({ id: "ch-slack-1" }) },
    );
    const json = await res.json();

    expect(json).toEqual({ ok: true });
    expect(mockHelpRequestUpdate).toHaveBeenCalledWith({
      where: { id: "req-2" },
      data: expect.objectContaining({
        approvalDecision: "denied",
        status: "responded",
      }),
    });
    expect(mockUpdateMessage).toHaveBeenCalledWith(
      "xoxb-test-token",
      "C0123456789",
      "1234567890.123456",
      expect.stringContaining("Denied"),
    );
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
      makeInteractiveRequest(makeApprovePayload("req-3")),
      { params: Promise.resolve({ id: "ch-slack-1" }) },
    );
    const json = await res.json();

    expect(json).toEqual({ ok: true });
    expect(mockHelpRequestUpdate).not.toHaveBeenCalled();
    expect(mockUpdateMessage).toHaveBeenCalledWith(
      "xoxb-test-token",
      "C0123456789",
      "1234567890.123456",
      expect.stringContaining("Already approved"),
    );
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
      makeInteractiveRequest(makeApprovePayload("req-4")),
      { params: Promise.resolve({ id: "ch-slack-1" }) },
    );
    const json = await res.json();

    expect(json).toEqual({ ok: true });
    expect(mockHelpRequestUpdate).not.toHaveBeenCalled();
    expect(mockUpdateMessage).toHaveBeenCalledWith(
      "xoxb-test-token",
      "C0123456789",
      "1234567890.123456",
      expect.stringContaining("expired"),
    );
  });

  it("handles request not found", async () => {
    mockHelpRequestFindFirst.mockResolvedValue(null);

    const res = await POST(
      makeInteractiveRequest(makeApprovePayload("nonexistent-id")),
      { params: Promise.resolve({ id: "ch-slack-1" }) },
    );
    const json = await res.json();

    expect(json).toEqual({ ok: true });
    expect(mockHelpRequestUpdate).not.toHaveBeenCalled();
    expect(mockUpdateMessage).not.toHaveBeenCalled();
  });

  it("ignores unknown action_id", async () => {
    const payload = makeApprovePayload("req-1");
    payload.actions[0].action_id = "unknown_action";

    const res = await POST(
      makeInteractiveRequest(payload),
      { params: Promise.resolve({ id: "ch-slack-1" }) },
    );
    const json = await res.json();

    expect(json).toEqual({ ok: true });
    expect(mockHelpRequestFindFirst).not.toHaveBeenCalled();
  });

  it("uses container fallback when channel/message not in top-level", async () => {
    mockHelpRequestFindFirst.mockResolvedValue({
      id: "req-5",
      refCode: "HS-CTR5",
      expertId: "user-1",
      requiresApproval: true,
      approvalDecision: null,
      status: "pending",
    } as never);
    mockHelpRequestUpdate.mockResolvedValue({} as never);
    mockMessageCreate.mockResolvedValue({} as never);

    const payload = {
      type: "block_actions",
      user: { id: "U0123", username: "testuser" },
      actions: [{ action_id: "approve_request", value: "req-5" }],
      container: { channel_id: "C0123456789", message_ts: "9999.999" },
    };

    const res = await POST(
      makeInteractiveRequest(payload),
      { params: Promise.resolve({ id: "ch-slack-1" }) },
    );
    const json = await res.json();

    expect(json).toEqual({ ok: true });
    expect(mockUpdateMessage).toHaveBeenCalledWith(
      "xoxb-test-token",
      "C0123456789",
      "9999.999",
      expect.stringContaining("Approved"),
    );
  });

  describe("ack_notification", () => {
    function makeAckPayload(requestId: string) {
      return {
        type: "block_actions",
        user: { id: "U0123", username: "testuser" },
        actions: [{ action_id: "ack_notification", value: requestId }],
        channel: { id: "C0123456789" },
        message: { ts: "1234567890.123456", text: "Notification" },
      };
    }

    it("acknowledges a notification via the shared service and updates the message", async () => {
      const ackedAt = new Date("2026-04-23T08:00:00.000Z");
      mockAcknowledgeNotification.mockResolvedValue({
        ok: true,
        status: "acknowledged",
        acknowledgedAt: ackedAt,
        alreadyAcknowledged: false,
      });

      const res = await POST(
        makeInteractiveRequest(makeAckPayload("req-ntf-1")),
        { params: Promise.resolve({ id: "ch-slack-1" }) },
      );
      const json = await res.json();

      expect(json).toEqual({ ok: true });
      expect(mockAcknowledgeNotification).toHaveBeenCalledWith({
        requestId: "req-ntf-1",
        expertUserId: "user-1",
        source: "slack",
      });
      expect(mockHelpRequestFindFirst).not.toHaveBeenCalled();
      expect(mockUpdateMessage).toHaveBeenCalledWith(
        "xoxb-test-token",
        "C0123456789",
        "1234567890.123456",
        expect.stringContaining("Acknowledged"),
      );
    });

    it("shows 'Already acknowledged' on idempotent ack", async () => {
      mockAcknowledgeNotification.mockResolvedValue({
        ok: true,
        status: "acknowledged",
        acknowledgedAt: new Date(),
        alreadyAcknowledged: true,
      });

      await POST(makeInteractiveRequest(makeAckPayload("req-ntf-2")), {
        params: Promise.resolve({ id: "ch-slack-1" }),
      });

      expect(mockUpdateMessage).toHaveBeenCalledWith(
        "xoxb-test-token",
        "C0123456789",
        "1234567890.123456",
        expect.stringContaining("Already acknowledged"),
      );
    });

    it("surfaces NOT_APPLICABLE when service rejects the request kind", async () => {
      mockAcknowledgeNotification.mockResolvedValue({
        ok: false,
        code: "NOT_APPLICABLE",
        message: "This request expects a reply; use /close to end the conversation",
      });

      await POST(makeInteractiveRequest(makeAckPayload("req-ntf-3")), {
        params: Promise.resolve({ id: "ch-slack-1" }),
      });

      expect(mockUpdateMessage).toHaveBeenCalledWith(
        "xoxb-test-token",
        "C0123456789",
        "1234567890.123456",
        expect.stringContaining("not applicable"),
      );
    });

    it("surfaces NOT_FOUND when the request is missing", async () => {
      mockAcknowledgeNotification.mockResolvedValue({
        ok: false,
        code: "NOT_FOUND",
        message: "Request not found",
      });

      await POST(makeInteractiveRequest(makeAckPayload("req-missing")), {
        params: Promise.resolve({ id: "ch-slack-1" }),
      });

      expect(mockUpdateMessage).toHaveBeenCalledWith(
        "xoxb-test-token",
        "C0123456789",
        "1234567890.123456",
        expect.stringContaining("not found"),
      );
    });
  });

  it("rejects invalid signature", async () => {
    mockVerifySignature.mockReturnValue(false);

    const res = await POST(
      makeInteractiveRequest(makeApprovePayload("req-1")),
      { params: Promise.resolve({ id: "ch-slack-1" }) },
    );

    expect(res.status).toBe(403);
    expect(mockHelpRequestFindFirst).not.toHaveBeenCalled();
  });
});
