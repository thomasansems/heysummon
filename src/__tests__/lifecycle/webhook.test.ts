import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import crypto from "crypto";

// Mock Prisma before imports
vi.mock("@/lib/prisma", () => ({
  prisma: {
    userProfile: {
      findFirst: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import {
  deliverWebhook,
  dispatchWebhookToProvider,
  type WebhookConfig,
  type WebhookPayload,
} from "@/lib/webhook";

const mockFindFirst = vi.mocked(prisma.userProfile.findFirst);

describe("webhook", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.useRealTimers();
  });

  describe("deliverWebhook", () => {
    const config: WebhookConfig = {
      url: "https://example.com/webhook",
      secret: "test-secret",
    };

    const payload: WebhookPayload = {
      type: "new_request",
      requestId: "req-1",
      refCode: "ABC123",
    };

    it("returns ok: true on successful delivery", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });

      const result = await deliverWebhook(config, payload);

      expect(result).toEqual({ ok: true, status: 200 });
      expect(global.fetch).toHaveBeenCalledWith(
        config.url,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(payload),
        })
      );
    });

    it("includes HMAC-SHA256 signature when secret is provided", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });

      await deliverWebhook(config, payload);

      const body = JSON.stringify(payload);
      const expectedSignature =
        "sha256=" +
        crypto.createHmac("sha256", "test-secret").update(body).digest("hex");

      const callArgs = vi.mocked(global.fetch).mock.calls[0];
      const headers = (callArgs[1] as RequestInit).headers as Record<string, string>;
      expect(headers["X-HeySummon-Signature"]).toBe(expectedSignature);
    });

    it("does not include signature when no secret is provided", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });

      await deliverWebhook({ url: "https://example.com/hook" }, payload);

      const callArgs = vi.mocked(global.fetch).mock.calls[0];
      const headers = (callArgs[1] as RequestInit).headers as Record<string, string>;
      expect(headers["X-HeySummon-Signature"]).toBeUndefined();
    });

    it("includes correct headers", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });

      await deliverWebhook(config, payload);

      const callArgs = vi.mocked(global.fetch).mock.calls[0];
      const headers = (callArgs[1] as RequestInit).headers as Record<string, string>;
      expect(headers["Content-Type"]).toBe("application/json");
      expect(headers["User-Agent"]).toBe("HeySummon-Webhook/1.0");
      expect(headers["X-HeySummon-Event"]).toBe("new_request");
      expect(headers["X-HeySummon-Timestamp"]).toBeDefined();
    });

    it("does not retry on 4xx client errors (except 429)", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
      });

      const result = await deliverWebhook(config, payload);

      expect(result).toEqual({ ok: false, error: "HTTP 400" });
      expect(global.fetch).toHaveBeenCalledTimes(1); // No retries
    });

    it("retries on 429 rate limit", async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({ ok: false, status: 429 })
        .mockResolvedValueOnce({ ok: false, status: 429 })
        .mockResolvedValueOnce({ ok: true, status: 200 });

      const result = await deliverWebhook(config, payload);

      expect(result).toEqual({ ok: true, status: 200 });
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it("retries on 5xx server errors", async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({ ok: false, status: 500 })
        .mockResolvedValueOnce({ ok: true, status: 200 });

      const result = await deliverWebhook(config, payload);

      expect(result).toEqual({ ok: true, status: 200 });
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it("retries on network errors", async () => {
      global.fetch = vi
        .fn()
        .mockRejectedValueOnce(new Error("ECONNREFUSED"))
        .mockResolvedValueOnce({ ok: true, status: 200 });

      const result = await deliverWebhook(config, payload);

      expect(result).toEqual({ ok: true, status: 200 });
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it("returns error after exhausting all retries", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });

      const result = await deliverWebhook(config, payload);

      expect(result.ok).toBe(false);
      expect(result.error).toBe("HTTP 500");
      expect(global.fetch).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
    });

    it("handles timeout (abort) errors", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("The operation was aborted"));

      const result = await deliverWebhook({ ...config, retries: 0 }, payload);

      expect(result).toEqual({ ok: false, error: "The operation was aborted" });
    });

    it("respects custom retry count", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
      });

      await deliverWebhook({ ...config, retries: 0 }, payload);

      expect(global.fetch).toHaveBeenCalledTimes(1); // No retries
    });

    it("merges custom headers", async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });

      await deliverWebhook(
        { ...config, headers: { "X-Custom": "value" } },
        payload
      );

      const callArgs = vi.mocked(global.fetch).mock.calls[0];
      const headers = (callArgs[1] as RequestInit).headers as Record<string, string>;
      expect(headers["X-Custom"]).toBe("value");
    });
  });

  describe("dispatchWebhookToProvider", () => {
    const payload: WebhookPayload = {
      type: "new_request",
      requestId: "req-1",
    };

    it("does nothing when no webhook providers exist", async () => {
      mockFindFirst.mockResolvedValue({
        channelProviders: [],
      } as never);

      global.fetch = vi.fn();

      await dispatchWebhookToProvider("user-1", payload);

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("does nothing when user profile is not found", async () => {
      mockFindFirst.mockResolvedValue(null);

      global.fetch = vi.fn();

      await dispatchWebhookToProvider("user-1", payload);

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("dispatches to all active webhook channels", async () => {
      mockFindFirst.mockResolvedValue({
        channelProviders: [
          {
            id: "ch-1",
            name: "Webhook 1",
            config: JSON.stringify({ url: "https://hook1.example.com", secret: "s1" }),
          },
          {
            id: "ch-2",
            name: "Webhook 2",
            config: JSON.stringify({ url: "https://hook2.example.com" }),
          },
        ],
      } as never);

      global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });

      await dispatchWebhookToProvider("user-1", payload);

      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it("handles invalid JSON config gracefully", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      mockFindFirst.mockResolvedValue({
        channelProviders: [
          { id: "ch-bad", name: "Bad", config: "not-json" },
        ],
      } as never);

      global.fetch = vi.fn();

      await dispatchWebhookToProvider("user-1", payload);

      expect(global.fetch).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Invalid config for channel ch-bad")
      );
      consoleSpy.mockRestore();
    });

    it("handles missing URL in config gracefully", async () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      mockFindFirst.mockResolvedValue({
        channelProviders: [
          { id: "ch-nourl", name: "NoURL", config: JSON.stringify({}) },
        ],
      } as never);

      global.fetch = vi.fn();

      await dispatchWebhookToProvider("user-1", payload);

      expect(global.fetch).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("No URL configured for channel ch-nourl")
      );
      consoleSpy.mockRestore();
    });

    it("handles fetch errors for individual providers without affecting others", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      vi.spyOn(console, "log").mockImplementation(() => {});

      mockFindFirst.mockResolvedValue({
        channelProviders: [
          { id: "ch-1", name: "Failing", config: JSON.stringify({ url: "https://fail.example.com", retries: 0 }) },
          { id: "ch-2", name: "Working", config: JSON.stringify({ url: "https://work.example.com", retries: 0 }) },
        ],
      } as never);

      global.fetch = vi
        .fn()
        .mockRejectedValueOnce(new Error("network error"))
        .mockResolvedValueOnce({ ok: true, status: 200 });

      await dispatchWebhookToProvider("user-1", payload);

      // Both should have been attempted
      expect(global.fetch).toHaveBeenCalledTimes(2);
      consoleSpy.mockRestore();
    });
  });
});
