import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    userProfile: { count: vi.fn() },
    apiKey: { count: vi.fn() },
    user: { update: vi.fn() },
  },
}));

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GET } from "@/app/api/onboarding/status/route";

const mockGetCurrentUser = vi.mocked(getCurrentUser);
const mockUserProfileCount = vi.mocked(prisma.userProfile.count);
const mockApiKeyCount = vi.mocked(prisma.apiKey.count);
const mockUserUpdate = vi.mocked(prisma.user.update);

type MinimalUser = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  onboardingComplete: boolean;
};

function makeUser(overrides: Partial<MinimalUser> = {}): MinimalUser {
  return {
    id: "user-1",
    email: "user@example.com",
    name: "User One",
    role: "admin",
    onboardingComplete: false,
    ...overrides,
  };
}

describe("GET /api/onboarding/status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserUpdate.mockResolvedValue({} as never);
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("T1: first run — no experts, no keys, onboardingComplete false", async () => {
    mockGetCurrentUser.mockResolvedValue(makeUser({ id: "admin-1", onboardingComplete: false }) as never);
    mockUserProfileCount.mockResolvedValue(0);
    mockApiKeyCount.mockResolvedValue(0);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      onboardingComplete: false,
      hasExpert: false,
      hasClient: false,
      expertCount: 0,
      clientCount: 0,
    });
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });

  it("T2: second user — platform configured, flips onboardingComplete to true", async () => {
    mockGetCurrentUser.mockResolvedValue(makeUser({ id: "user-2", onboardingComplete: false }) as never);
    mockUserProfileCount.mockResolvedValue(1);
    mockApiKeyCount.mockResolvedValue(1);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      onboardingComplete: true,
      hasExpert: true,
      hasClient: true,
      expertCount: 1,
      clientCount: 1,
    });
    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: "user-2" },
      data: { onboardingComplete: true },
    });
  });

  it("T3: admin already complete — no DB write", async () => {
    mockGetCurrentUser.mockResolvedValue(makeUser({ id: "admin-1", onboardingComplete: true }) as never);
    mockUserProfileCount.mockResolvedValue(1);
    mockApiKeyCount.mockResolvedValue(1);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      onboardingComplete: true,
      hasExpert: true,
      hasClient: true,
    });
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });

  it("T4: partial setup (expert but no key) — no flip, guard still routes to onboarding", async () => {
    mockGetCurrentUser.mockResolvedValue(makeUser({ id: "admin-1", onboardingComplete: false }) as never);
    mockUserProfileCount.mockResolvedValue(1);
    mockApiKeyCount.mockResolvedValue(0);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      onboardingComplete: false,
      hasExpert: true,
      hasClient: false,
      expertCount: 1,
      clientCount: 0,
    });
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });

  it("uses global counts, never filters by user id", async () => {
    mockGetCurrentUser.mockResolvedValue(makeUser({ onboardingComplete: true }) as never);
    mockUserProfileCount.mockResolvedValue(5);
    mockApiKeyCount.mockResolvedValue(3);

    await GET();

    expect(mockUserProfileCount).toHaveBeenCalledWith();
    expect(mockApiKeyCount).toHaveBeenCalledWith();
  });
});
