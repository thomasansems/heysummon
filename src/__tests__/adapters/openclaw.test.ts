import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import crypto from "node:crypto";

// Mock Prisma before imports
vi.mock("@/lib/prisma", () => ({
  prisma: {
    channelProvider: {
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

// Mock public-url
vi.mock("@/lib/public-url", () => ({
  getPublicBaseUrl: vi.fn(() => "https://heysummon.example.com"),
}));

import { openClawAdapter, sendNotification, sendNotificationWithActions, verifyWebhookSignature } from "@/lib/adapters/openclaw";

describe("OpenClaw Adapter", () => {
  describe("validateConfig", () => {
    it("rejects empty config", () => {
      const result = openClawAdapter.validateConfig(null);
      expect(result.valid).toBe(false);
    });

    it("rejects missing apiKey", () => {
      const result = openClawAdapter.validateConfig({});
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain("API key");
      }
    });

    it("rejects empty apiKey", () => {
      const result = openClawAdapter.validateConfig({ apiKey: "  " });
      expect(result.valid).toBe(false);
    });

    it("accepts valid config", () => {
      const result = openClawAdapter.validateConfig({ apiKey: "oc_test_123" });
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.config).toEqual({ apiKey: "oc_test_123" });
      }
    });

    it("accepts config with webhookUrl", () => {
      const result = openClawAdapter.validateConfig({
        apiKey: "oc_test_123",
        webhookUrl: "https://example.com/webhook",
      });
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.config).toEqual({
          apiKey: "oc_test_123",
          webhookUrl: "https://example.com/webhook",
        });
      }
    });

    it("trims apiKey whitespace", () => {
      const result = openClawAdapter.validateConfig({ apiKey: "  oc_test  " });
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.config).toEqual({ apiKey: "oc_test" });
      }
    });
  });

  describe("verifyWebhookSignature", () => {
    const secret = "test-webhook-secret";

    it("verifies a valid signature", () => {
      const body = JSON.stringify({ action: "approve", requestId: "req-1" });
      const signature = crypto.createHmac("sha256", secret).update(body).digest("hex");
      expect(verifyWebhookSignature(secret, body, signature)).toBe(true);
    });

    it("rejects an invalid signature", () => {
      const body = JSON.stringify({ action: "approve", requestId: "req-1" });
      expect(verifyWebhookSignature(secret, body, "invalid-signature")).toBe(false);
    });

    it("rejects a signature for different body", () => {
      const body = JSON.stringify({ action: "approve", requestId: "req-1" });
      const otherBody = JSON.stringify({ action: "deny", requestId: "req-1" });
      const signature = crypto.createHmac("sha256", secret).update(otherBody).digest("hex");
      expect(verifyWebhookSignature(secret, body, signature)).toBe(false);
    });

    it("rejects empty signature", () => {
      const body = JSON.stringify({ action: "approve" });
      expect(verifyWebhookSignature(secret, body, "")).toBe(false);
    });
  });

  describe("sendNotification", () => {
    beforeEach(() => {
      vi.stubGlobal("fetch", vi.fn());
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("sends notification with correct headers and body", async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValue(new Response("ok", { status: 200 }));

      const payload = { type: "message", message: "Hello" };
      await sendNotification("https://example.com/webhook", "api-key", "secret", payload);

      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toBe("https://example.com/webhook");
      expect(opts?.method).toBe("POST");

      const headers = opts?.headers as Record<string, string>;
      expect(headers["Content-Type"]).toBe("application/json");
      expect(headers["Authorization"]).toBe("Bearer api-key");
      expect(headers["X-OpenClaw-Signature"]).toBeDefined();

      // Verify the signature is valid
      const body = opts?.body as string;
      const expectedSig = crypto.createHmac("sha256", "secret").update(body).digest("hex");
      expect(headers["X-OpenClaw-Signature"]).toBe(expectedSig);
    });

    it("throws on non-ok response", async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValue(new Response("Bad Request", { status: 400 }));

      await expect(
        sendNotification("https://example.com/webhook", "api-key", "secret", { type: "message" }),
      ).rejects.toThrow("Failed to send OpenClaw notification");
    });
  });

  describe("sendNotificationWithActions", () => {
    beforeEach(() => {
      vi.stubGlobal("fetch", vi.fn());
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("sends notification with approve/deny action URLs", async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValue(new Response("ok", { status: 200 }));

      await sendNotificationWithActions(
        "https://example.com/webhook",
        "api-key",
        "secret",
        "https://heysummon.example.com/api/adapters/openclaw/ch-1/webhook",
        {
          requestId: "req-1",
          refCode: "HS-ABC1",
          message: "Approval required HS-ABC1",
        },
      );

      expect(mockFetch).toHaveBeenCalledOnce();
      const body = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      expect(body.type).toBe("approval_required");
      expect(body.requestId).toBe("req-1");
      expect(body.refCode).toBe("HS-ABC1");
      expect(body.actions.approve).toContain("action=approve&requestId=req-1");
      expect(body.actions.deny).toContain("action=deny&requestId=req-1");
      expect(body.callbackUrl).toBe("https://heysummon.example.com/api/adapters/openclaw/ch-1/webhook");
    });
  });

  describe("onActivate", () => {
    it("generates webhook secret and updates channel", async () => {
      const { prisma } = await import("@/lib/prisma");
      const mockUpdate = vi.mocked(prisma.channelProvider.update);
      mockUpdate.mockResolvedValue({} as never);

      await openClawAdapter.onActivate!("ch-oc-1", { apiKey: "oc_test" });

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: "ch-oc-1" },
        data: expect.objectContaining({
          status: "connected",
        }),
      });

      // Verify the config contains a webhookSecret
      const call = mockUpdate.mock.calls[0][0];
      const storedConfig = JSON.parse(call.data.config as string);
      expect(storedConfig.webhookSecret).toBeDefined();
      expect(typeof storedConfig.webhookSecret).toBe("string");
      expect(storedConfig.webhookSecret.length).toBe(64); // 32 bytes hex
    });
  });
});
