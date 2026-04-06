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

import { prisma } from "@/lib/prisma";
import { answerCallbackQuery, editMessageText } from "@/lib/adapters/telegram";
import { POST } from "@/app/api/adapters/telegram/[id]/webhook/route";
import { NextRequest } from "next/server";

const mockFindUnique = vi.mocked(prisma.expertChannel.findUnique);
const mockChannelUpdate = vi.mocked(prisma.expertChannel.update);
const mockHelpRequestFindFirst = vi.mocked(prisma.helpRequest.findFirst);
const mockHelpRequestUpdate = vi.mocked(prisma.helpRequest.update);
const mockMessageCreate = vi.mocked(prisma.message.create);
const mockAnswerCbq = vi.mocked(answerCallbackQuery);
const mockEditMessage = vi.mocked(editMessageText);

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
