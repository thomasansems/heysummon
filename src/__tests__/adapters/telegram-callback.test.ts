import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

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

// Mock Telegram adapter functions
vi.mock("@/lib/adapters/telegram", () => ({
  sendMessage: vi.fn(),
  answerCallbackQuery: vi.fn(),
  editMessageText: vi.fn(),
}));

vi.mock("@/services/notifications/acknowledge", () => ({
  acknowledgeNotification: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { answerCallbackQuery, editMessageText } from "@/lib/adapters/telegram";
import { acknowledgeNotification } from "@/services/notifications/acknowledge";
import { POST } from "@/app/api/adapters/telegram/[id]/webhook/route";
import { NextRequest } from "next/server";

const mockFindUnique = vi.mocked(prisma.expertChannel.findUnique);
const mockChannelUpdate = vi.mocked(prisma.expertChannel.update);
const mockHelpRequestFindFirst = vi.mocked(prisma.helpRequest.findFirst);
const mockHelpRequestUpdate = vi.mocked(prisma.helpRequest.update);
const mockMessageCreate = vi.mocked(prisma.message.create);
const mockAnswerCbq = vi.mocked(answerCallbackQuery);
const mockEditMessage = vi.mocked(editMessageText);
const mockAcknowledgeNotification = vi.mocked(acknowledgeNotification);

function makeRequest(body: unknown, secret: string) {
  return new NextRequest("http://localhost/api/adapters/telegram/ch-1/webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-telegram-bot-api-secret-token": secret,
    },
    body: JSON.stringify(body),
  });
}

const channelConfig = {
  botToken: "123:TOKEN",
  webhookSecret: "secret123",
  expertChatId: "42",
};

const mockChannel = {
  id: "ch-1",
  type: "telegram",
  isActive: true,
  config: JSON.stringify(channelConfig),
  profile: { userId: "user-1" },
};

describe("Telegram webhook callback_query handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindUnique.mockResolvedValue(mockChannel as never);
    mockChannelUpdate.mockResolvedValue({} as never);
    mockAnswerCbq.mockResolvedValue(undefined);
    mockEditMessage.mockResolvedValue(undefined);
  });

  it("handles approve callback and updates help request", async () => {
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

    const body = {
      update_id: 1,
      callback_query: {
        id: "cbq-1",
        from: { id: 42, first_name: "Test" },
        message: { message_id: 100, chat: { id: 42, type: "private" } },
        data: "approve:req-1",
      },
    };

    const res = await POST(makeRequest(body, "secret123"), {
      params: Promise.resolve({ id: "ch-1" }),
    });
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
    expect(mockAnswerCbq).toHaveBeenCalledWith("123:TOKEN", "cbq-1", "\u2713 Approved");
    expect(mockEditMessage).toHaveBeenCalledWith(
      "123:TOKEN",
      "42",
      100,
      expect.stringContaining("Approved")
    );
  });

  it("handles deny callback and updates help request", async () => {
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

    const body = {
      update_id: 2,
      callback_query: {
        id: "cbq-2",
        from: { id: 42, first_name: "Test" },
        message: { message_id: 101, chat: { id: 42, type: "private" } },
        data: "deny:req-2",
      },
    };

    const res = await POST(makeRequest(body, "secret123"), {
      params: Promise.resolve({ id: "ch-1" }),
    });
    const json = await res.json();

    expect(json).toEqual({ ok: true });
    expect(mockHelpRequestUpdate).toHaveBeenCalledWith({
      where: { id: "req-2" },
      data: expect.objectContaining({
        approvalDecision: "denied",
        status: "responded",
      }),
    });
    expect(mockAnswerCbq).toHaveBeenCalledWith("123:TOKEN", "cbq-2", "\u2717 Denied");
  });

  it("rejects callback from unauthorized chat", async () => {
    const body = {
      update_id: 3,
      callback_query: {
        id: "cbq-3",
        from: { id: 999, first_name: "Hacker" },
        message: { message_id: 102, chat: { id: 999, type: "private" } },
        data: "approve:req-1",
      },
    };

    const res = await POST(makeRequest(body, "secret123"), {
      params: Promise.resolve({ id: "ch-1" }),
    });
    const json = await res.json();

    expect(json).toEqual({ ok: true });
    expect(mockAnswerCbq).toHaveBeenCalledWith("123:TOKEN", "cbq-3", "Not authorized");
    expect(mockHelpRequestFindFirst).not.toHaveBeenCalled();
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

    const body = {
      update_id: 4,
      callback_query: {
        id: "cbq-4",
        from: { id: 42, first_name: "Test" },
        message: { message_id: 103, chat: { id: 42, type: "private" } },
        data: "approve:req-3",
      },
    };

    const res = await POST(makeRequest(body, "secret123"), {
      params: Promise.resolve({ id: "ch-1" }),
    });
    const json = await res.json();

    expect(json).toEqual({ ok: true });
    expect(mockAnswerCbq).toHaveBeenCalledWith("123:TOKEN", "cbq-4", "Already approved");
    expect(mockHelpRequestUpdate).not.toHaveBeenCalled();
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

    const body = {
      update_id: 5,
      callback_query: {
        id: "cbq-5",
        from: { id: 42, first_name: "Test" },
        message: { message_id: 104, chat: { id: 42, type: "private" } },
        data: "approve:req-4",
      },
    };

    const res = await POST(makeRequest(body, "secret123"), {
      params: Promise.resolve({ id: "ch-1" }),
    });
    const json = await res.json();

    expect(json).toEqual({ ok: true });
    expect(mockAnswerCbq).toHaveBeenCalledWith("123:TOKEN", "cbq-5", "Request is expired");
    expect(mockHelpRequestUpdate).not.toHaveBeenCalled();
  });

  it("handles request not found", async () => {
    mockHelpRequestFindFirst.mockResolvedValue(null);

    const body = {
      update_id: 6,
      callback_query: {
        id: "cbq-6",
        from: { id: 42, first_name: "Test" },
        message: { message_id: 105, chat: { id: 42, type: "private" } },
        data: "approve:nonexistent-id",
      },
    };

    const res = await POST(makeRequest(body, "secret123"), {
      params: Promise.resolve({ id: "ch-1" }),
    });
    const json = await res.json();

    expect(json).toEqual({ ok: true });
    expect(mockAnswerCbq).toHaveBeenCalledWith("123:TOKEN", "cbq-6", "Request not found");
    expect(mockHelpRequestUpdate).not.toHaveBeenCalled();
  });

  describe("ack callback", () => {
    function makeAckBody(updateId: number, requestId: string, messageId = 200) {
      return {
        update_id: updateId,
        callback_query: {
          id: `cbq-ack-${updateId}`,
          from: { id: 42, first_name: "Test" },
          message: { message_id: messageId, chat: { id: 42, type: "private" } },
          data: `ack:${requestId}`,
        },
      };
    }

    it("acknowledges a notification via the shared service and edits the message", async () => {
      const ackedAt = new Date("2026-04-23T08:00:00.000Z");
      mockAcknowledgeNotification.mockResolvedValue({
        ok: true,
        status: "acknowledged",
        acknowledgedAt: ackedAt,
        alreadyAcknowledged: false,
      });

      const res = await POST(makeRequest(makeAckBody(10, "req-ntf-1"), "secret123"), {
        params: Promise.resolve({ id: "ch-1" }),
      });

      expect(await res.json()).toEqual({ ok: true });
      expect(mockAcknowledgeNotification).toHaveBeenCalledWith({
        requestId: "req-ntf-1",
        expertUserId: "user-1",
        source: "telegram",
      });
      // Approve/deny path must not touch the help request when ack handles it.
      expect(mockHelpRequestFindFirst).not.toHaveBeenCalled();
      expect(mockHelpRequestUpdate).not.toHaveBeenCalled();
      expect(mockAnswerCbq).toHaveBeenCalledWith("123:TOKEN", "cbq-ack-10", "Acknowledged");
      expect(mockEditMessage).toHaveBeenCalledWith(
        "123:TOKEN",
        "42",
        200,
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

      await POST(makeRequest(makeAckBody(11, "req-ntf-2"), "secret123"), {
        params: Promise.resolve({ id: "ch-1" }),
      });

      expect(mockAnswerCbq).toHaveBeenCalledWith(
        "123:TOKEN",
        "cbq-ack-11",
        "Already acknowledged",
      );
      expect(mockEditMessage).toHaveBeenCalledWith(
        "123:TOKEN",
        "42",
        200,
        expect.stringContaining("Already acknowledged"),
      );
    });

    it("surfaces NOT_APPLICABLE when service rejects the request kind", async () => {
      mockAcknowledgeNotification.mockResolvedValue({
        ok: false,
        code: "NOT_APPLICABLE",
        message: "This request expects a reply; use /close to end the conversation",
      });

      await POST(makeRequest(makeAckBody(12, "req-ntf-3"), "secret123"), {
        params: Promise.resolve({ id: "ch-1" }),
      });

      expect(mockAnswerCbq).toHaveBeenCalledWith("123:TOKEN", "cbq-ack-12", "Not applicable");
      expect(mockEditMessage).toHaveBeenCalledWith(
        "123:TOKEN",
        "42",
        200,
        expect.stringContaining("not applicable"),
      );
    });

    it("surfaces NOT_FOUND when the request is missing", async () => {
      mockAcknowledgeNotification.mockResolvedValue({
        ok: false,
        code: "NOT_FOUND",
        message: "Request not found",
      });

      await POST(makeRequest(makeAckBody(13, "req-missing"), "secret123"), {
        params: Promise.resolve({ id: "ch-1" }),
      });

      expect(mockAnswerCbq).toHaveBeenCalledWith(
        "123:TOKEN",
        "cbq-ack-13",
        "Request not found",
      );
      expect(mockEditMessage).toHaveBeenCalledWith(
        "123:TOKEN",
        "42",
        200,
        expect.stringContaining("not found"),
      );
    });

    it("rejects ack from unauthorized chat (no service call)", async () => {
      const body = {
        update_id: 14,
        callback_query: {
          id: "cbq-ack-14",
          from: { id: 999, first_name: "Hacker" },
          message: { message_id: 201, chat: { id: 999, type: "private" } },
          data: "ack:req-ntf-1",
        },
      };

      await POST(makeRequest(body, "secret123"), {
        params: Promise.resolve({ id: "ch-1" }),
      });

      expect(mockAcknowledgeNotification).not.toHaveBeenCalled();
      expect(mockAnswerCbq).toHaveBeenCalledWith("123:TOKEN", "cbq-ack-14", "Not authorized");
    });
  });

  it("handles unknown callback_data format", async () => {
    const body = {
      update_id: 7,
      callback_query: {
        id: "cbq-7",
        from: { id: 42, first_name: "Test" },
        message: { message_id: 106, chat: { id: 42, type: "private" } },
        data: "invalid-format",
      },
    };

    const res = await POST(makeRequest(body, "secret123"), {
      params: Promise.resolve({ id: "ch-1" }),
    });
    const json = await res.json();

    expect(json).toEqual({ ok: true });
    expect(mockAnswerCbq).toHaveBeenCalledWith("123:TOKEN", "cbq-7", "Unknown action");
    expect(mockHelpRequestFindFirst).not.toHaveBeenCalled();
  });
});
