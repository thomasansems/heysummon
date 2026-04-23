import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    setupToken: { findFirst: vi.fn() },
    ipEvent: { findFirst: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { GET } from "@/app/api/v1/setup/[token]/command/route";

const mockSetupTokenFindFirst = vi.mocked(prisma.setupToken.findFirst);
const mockIpEventFindFirst = vi.mocked(prisma.ipEvent.findFirst);

function makeSetupToken(overrides: Record<string, unknown> = {}) {
  return {
    id: "st-id",
    token: "st_token",
    apiKeyId: "key-id",
    baseUrl: "https://hs.example.com",
    channel: "custom",
    subChannel: "n8n",
    expertName: "Thomas",
    summonContext: null,
    timeout: 900,
    pollInterval: 3,
    timeoutFallback: "proceed_cautiously",
    globalInstall: true,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    apiKey: { id: "key-id", key: "hs_cli_testkey", name: "Test" },
    ...overrides,
  };
}

describe("GET /api/v1/setup/[token]/command — custom channel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIpEventFindFirst.mockResolvedValue(null);
  });

  it("returns a bash recipe with env exports and /api/v1/help curl", async () => {
    mockSetupTokenFindFirst.mockResolvedValue(makeSetupToken() as never);

    const response = await GET(new Request("http://localhost/irrelevant"), {
      params: Promise.resolve({ token: "st_token" }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.channel).toBe("custom");
    expect(typeof body.installCommand).toBe("string");
    expect(body.installCommand).toContain('export HEYSUMMON_BASE_URL="https://hs.example.com"');
    expect(body.installCommand).toContain('export HEYSUMMON_API_KEY="hs_cli_testkey"');
    expect(body.installCommand).toContain("/api/v1/help");
    expect(body.installCommand).not.toContain("cd ~/clawd");
  });

  it("returns 404 for an unknown token", async () => {
    mockSetupTokenFindFirst.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/irrelevant"), {
      params: Promise.resolve({ token: "st_missing" }),
    });

    expect(response.status).toBe(404);
  });
});
