import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    userProfile: { findUnique: vi.fn(), findFirst: vi.fn() },
    expertChannel: { findMany: vi.fn() },
    helpRequest: { create: vi.fn(), findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/api-key-auth", () => ({
  validateApiKeyRequest: vi.fn(),
}));

vi.mock("@/lib/refcode", () => ({
  generateUniqueRefCode: vi.fn(async () => "HS-PROBE01"),
}));

vi.mock("@/lib/audit", () => ({
  logAuditEvent: vi.fn(() => Promise.resolve()),
  AuditEventTypes: { SETUP_VERIFIED: "SETUP_VERIFIED" },
}));

// Telegram + Slack + OpenClaw fan-out spies — assert they are never called.
const telegramSendMessage = vi.fn();
const slackSendMessage = vi.fn();
const openclawSendNotification = vi.fn();

vi.mock("@/lib/adapters/telegram", () => ({
  sendMessage: telegramSendMessage,
  sendLongMessage: telegramSendMessage,
  sendMessageWithButtons: telegramSendMessage,
  escapeTelegramMarkdown: (s: string) => s,
}));
vi.mock("@/lib/adapters/slack", () => ({
  sendMessage: slackSendMessage,
  sendMessageWithBlocks: slackSendMessage,
}));
vi.mock("@/lib/adapters/openclaw", () => ({
  sendNotification: openclawSendNotification,
  sendNotificationWithActions: openclawSendNotification,
}));

import { prisma } from "@/lib/prisma";
import { validateApiKeyRequest } from "@/lib/api-key-auth";
import { POST } from "@/app/api/v1/setup/verify-roundtrip/route";

const mockProfileFindUnique = vi.mocked(prisma.userProfile.findUnique);
const mockProfileFindFirst = vi.mocked(prisma.userProfile.findFirst);
const mockChannelFindMany = vi.mocked(prisma.expertChannel.findMany);
const mockHelpRequestCreate = vi.mocked(prisma.helpRequest.create);
const mockValidateApiKey = vi.mocked(validateApiKeyRequest);

function makeRequest() {
  return new Request("http://localhost/api/v1/setup/verify-roundtrip", {
    method: "POST",
    headers: { "x-api-key": "hs_cli_test" },
  });
}

function authOk(overrides: Record<string, unknown> = {}) {
  return {
    ok: true as const,
    apiKey: {
      id: "key-1",
      userId: "u-1",
      expertId: "p-1",
      isActive: true,
      ...overrides,
    } as never,
  };
}

function activeProfile(overrides: Record<string, unknown> = {}) {
  return {
    id: "p-1",
    name: "Thomas",
    isActive: true,
    userId: "u-1",
    ...overrides,
  };
}

function telegramChannel(overrides: Record<string, unknown> = {}) {
  return {
    id: "c-1",
    type: "telegram",
    status: "connected",
    config: JSON.stringify({ botToken: "bot-token", expertChatId: "chat-id" }),
    ...overrides,
  };
}

describe("POST /api/v1/setup/verify-roundtrip", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    telegramSendMessage.mockReset();
    slackSendMessage.mockReset();
    openclawSendNotification.mockReset();
    mockHelpRequestCreate.mockResolvedValue({
      id: "probe-1",
      refCode: "HS-PROBE01",
    } as never);
  });

  it("200: creates a probe row and reports the dispatchable channel without dispatching fan-out", async () => {
    mockValidateApiKey.mockResolvedValue(authOk());
    mockProfileFindUnique.mockResolvedValue(activeProfile() as never);
    mockChannelFindMany.mockResolvedValue([telegramChannel()] as never);

    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      ok: true,
      expertName: "Thomas",
      channelType: "telegram",
    });

    expect(mockHelpRequestCreate).toHaveBeenCalledTimes(1);
    const createArgs = mockHelpRequestCreate.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect(createArgs.data.probe).toBe(true);
    expect(createArgs.data.status).toBe("closed");
    expect(createArgs.data.notifiedExpertAt).toBeNull();
    expect(createArgs.data.responseRequired).toBe(false);
    expect(createArgs.data.apiKeyId).toBe("key-1");
    expect(createArgs.data.expertId).toBe("u-1");

    // Critical: NO fan-out happened.
    expect(telegramSendMessage).not.toHaveBeenCalled();
    expect(slackSendMessage).not.toHaveBeenCalled();
    expect(openclawSendNotification).not.toHaveBeenCalled();
  });

  it("falls back to UserProfile.findFirst when the API key has no expertId", async () => {
    mockValidateApiKey.mockResolvedValue(authOk({ expertId: null }));
    mockProfileFindFirst.mockResolvedValue(activeProfile() as never);
    mockChannelFindMany.mockResolvedValue([telegramChannel()] as never);

    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(mockProfileFindFirst).toHaveBeenCalledWith({
      where: { userId: "u-1", isActive: true },
      select: expect.any(Object),
    });
  });

  it("401 auth: invalid api key", async () => {
    mockValidateApiKey.mockResolvedValue({
      ok: false,
      response: NextResponse.json(
        { error: "Invalid or inactive API key" },
        { status: 401 },
      ),
    });

    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({
      ok: false,
      code: "auth",
      error: expect.any(String),
    });
  });

  it("404 expert_disabled: profile is missing", async () => {
    mockValidateApiKey.mockResolvedValue(authOk());
    mockProfileFindUnique.mockResolvedValue(null);

    const res = await POST(makeRequest());
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe("expert_disabled");
    expect(mockHelpRequestCreate).not.toHaveBeenCalled();
  });

  it("404 expert_disabled: profile.isActive is false", async () => {
    mockValidateApiKey.mockResolvedValue(authOk());
    mockProfileFindUnique.mockResolvedValue(
      activeProfile({ isActive: false }) as never,
    );

    const res = await POST(makeRequest());
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe("expert_disabled");
    expect(mockHelpRequestCreate).not.toHaveBeenCalled();
  });

  it("422 no_channel: expert has no active channels", async () => {
    mockValidateApiKey.mockResolvedValue(authOk());
    mockProfileFindUnique.mockResolvedValue(activeProfile() as never);
    mockChannelFindMany.mockResolvedValue([] as never);

    const res = await POST(makeRequest());
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.code).toBe("no_channel");
    expect(mockHelpRequestCreate).not.toHaveBeenCalled();
  });

  it("422 encryption_unconfigured: channel exists but config is missing transport secrets", async () => {
    mockValidateApiKey.mockResolvedValue(authOk());
    mockProfileFindUnique.mockResolvedValue(activeProfile() as never);
    mockChannelFindMany.mockResolvedValue([
      // Telegram missing botToken — adapter cannot dispatch.
      telegramChannel({ config: JSON.stringify({ expertChatId: "x" }) }),
    ] as never);

    const res = await POST(makeRequest());
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.code).toBe("encryption_unconfigured");
    expect(mockHelpRequestCreate).not.toHaveBeenCalled();
  });

  it("500 internal: probe creation throws", async () => {
    mockValidateApiKey.mockResolvedValue(authOk());
    mockProfileFindUnique.mockResolvedValue(activeProfile() as never);
    mockChannelFindMany.mockResolvedValue([telegramChannel()] as never);
    mockHelpRequestCreate.mockRejectedValueOnce(new Error("db down"));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await POST(makeRequest());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.code).toBe("internal");

    errSpy.mockRestore();
  });
});
