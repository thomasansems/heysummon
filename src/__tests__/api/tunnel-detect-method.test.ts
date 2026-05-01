import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(),
}));

import { detectMethod } from "@/app/api/admin/tunnel/status/route";

describe("detectMethod", () => {
  it("classifies tailscale apex hostnames", () => {
    expect(detectMethod("https://my-tailnet.ts.net")).toBe("tailscale");
  });

  it("classifies tailscale subdomain hostnames", () => {
    expect(detectMethod("https://my-host.tailnet-cafe.ts.net")).toBe("tailscale");
  });

  it("classifies cloudflared trycloudflare.com hostnames", () => {
    expect(detectMethod("https://random.trycloudflare.com")).toBe("cloudflared");
  });

  it("classifies custom hostnames", () => {
    expect(detectMethod("https://heysummon.example.com")).toBe("custom");
  });

  it("returns custom for malformed URLs", () => {
    expect(detectMethod("not a url")).toBe("custom");
  });

  it("rejects attacker URLs that put .ts.net in the path", () => {
    expect(detectMethod("https://evil.com/.ts.net")).toBe("custom");
  });

  it("rejects attacker URLs that put trycloudflare.com in the query string", () => {
    expect(detectMethod("https://example.com?host=trycloudflare.com")).toBe("custom");
  });
});
