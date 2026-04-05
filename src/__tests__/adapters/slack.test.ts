import { describe, it, expect, vi, afterEach } from "vitest";
import {
  slackAdapter,
  verifySlackSignature,
  sendMessageWithBlocks,
  updateMessage,
} from "@/lib/adapters/slack";
import crypto from "node:crypto";

describe("Slack Adapter", () => {
  describe("validateConfig", () => {
    it("rejects empty config", () => {
      const result = slackAdapter.validateConfig(null);
      expect(result.valid).toBe(false);
    });

    it("rejects missing botToken", () => {
      const result = slackAdapter.validateConfig({
        signingSecret: "secret",
        channelId: "C123",
      });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain("Bot token");
      }
    });

    it("rejects missing signingSecret", () => {
      const result = slackAdapter.validateConfig({
        botToken: "xoxb-123",
        channelId: "C123",
      });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain("Signing secret");
      }
    });

    it("rejects missing channelId", () => {
      const result = slackAdapter.validateConfig({
        botToken: "xoxb-123",
        signingSecret: "secret",
      });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain("Channel ID");
      }
    });

    it("rejects empty botToken", () => {
      const result = slackAdapter.validateConfig({
        botToken: "",
        signingSecret: "secret",
        channelId: "C123",
      });
      expect(result.valid).toBe(false);
    });

    it("rejects empty signingSecret", () => {
      const result = slackAdapter.validateConfig({
        botToken: "xoxb-123",
        signingSecret: "",
        channelId: "C123",
      });
      expect(result.valid).toBe(false);
    });

    it("rejects empty channelId", () => {
      const result = slackAdapter.validateConfig({
        botToken: "xoxb-123",
        signingSecret: "secret",
        channelId: "  ",
      });
      expect(result.valid).toBe(false);
    });

    it("accepts valid config with required fields", () => {
      const result = slackAdapter.validateConfig({
        botToken: "xoxb-123-456-abc",
        signingSecret: "abc123secret",
        channelId: "C0123456789",
      });
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.config).toEqual({
          botToken: "xoxb-123-456-abc",
          signingSecret: "abc123secret",
          channelId: "C0123456789",
          teamId: undefined,
          teamName: undefined,
          botUserId: undefined,
        });
      }
    });

    it("accepts config with all fields", () => {
      const result = slackAdapter.validateConfig({
        botToken: "xoxb-123-456-abc",
        signingSecret: "abc123secret",
        channelId: "C0123456789",
        teamId: "T0123",
        teamName: "Test Workspace",
        botUserId: "U0123",
      });
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.config).toEqual({
          botToken: "xoxb-123-456-abc",
          signingSecret: "abc123secret",
          channelId: "C0123456789",
          teamId: "T0123",
          teamName: "Test Workspace",
          botUserId: "U0123",
        });
      }
    });

    it("trims whitespace from all fields", () => {
      const result = slackAdapter.validateConfig({
        botToken: "  xoxb-123  ",
        signingSecret: "  secret  ",
        channelId: "  C123  ",
      });
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.config).toHaveProperty("botToken", "xoxb-123");
        expect(result.config).toHaveProperty("signingSecret", "secret");
        expect(result.config).toHaveProperty("channelId", "C123");
      }
    });
  });

  describe("verifySlackSignature", () => {
    const signingSecret = "test_signing_secret_123";
    const timestamp = String(Math.floor(Date.now() / 1000));
    const body = '{"type":"event_callback","event":{"type":"message"}}';

    function computeSignature(secret: string, ts: string, rawBody: string): string {
      const baseString = `v0:${ts}:${rawBody}`;
      const hmac = crypto.createHmac("sha256", secret).update(baseString).digest("hex");
      return `v0=${hmac}`;
    }

    it("accepts valid signature", () => {
      const sig = computeSignature(signingSecret, timestamp, body);
      expect(verifySlackSignature(signingSecret, timestamp, body, sig)).toBe(true);
    });

    it("rejects invalid signature", () => {
      expect(verifySlackSignature(signingSecret, timestamp, body, "v0=invalid")).toBe(false);
    });

    it("rejects old timestamp (replay attack)", () => {
      const oldTs = String(Math.floor(Date.now() / 1000) - 600);
      const sig = computeSignature(signingSecret, oldTs, body);
      expect(verifySlackSignature(signingSecret, oldTs, body, sig)).toBe(false);
    });

    it("rejects wrong signing secret", () => {
      const sig = computeSignature("wrong_secret", timestamp, body);
      expect(verifySlackSignature(signingSecret, timestamp, body, sig)).toBe(false);
    });
  });

  describe("sendMessageWithBlocks", () => {
    const originalFetch = global.fetch;

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it("sends Block Kit message with approval buttons", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true }),
      });

      await sendMessageWithBlocks("xoxb-token", "C123", "Approval required `HS-ABC1`", [
        { text: "Approve", action_id: "approve_request", value: "req-1", style: "primary" },
        { text: "Deny", action_id: "deny_request", value: "req-1", style: "danger" },
      ]);

      expect(global.fetch).toHaveBeenCalledOnce();
      const [url, opts] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(url).toBe("https://slack.com/api/chat.postMessage");
      const body = JSON.parse(opts.body);
      expect(body.channel).toBe("C123");
      expect(body.text).toBe("Approval required `HS-ABC1`");
      expect(body.blocks).toHaveLength(2);
      expect(body.blocks[0].type).toBe("section");
      expect(body.blocks[0].text.text).toBe("Approval required `HS-ABC1`");
      expect(body.blocks[1].type).toBe("actions");
      expect(body.blocks[1].elements).toHaveLength(2);
      expect(body.blocks[1].elements[0]).toEqual({
        type: "button",
        text: { type: "plain_text", text: "Approve" },
        action_id: "approve_request",
        value: "req-1",
        style: "primary",
      });
      expect(body.blocks[1].elements[1]).toEqual({
        type: "button",
        text: { type: "plain_text", text: "Deny" },
        action_id: "deny_request",
        value: "req-1",
        style: "danger",
      });
    });

    it("omits style when not provided", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true }),
      });

      await sendMessageWithBlocks("xoxb-token", "C123", "Test", [
        { text: "OK", action_id: "test_action", value: "val-1" },
      ]);

      const body = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
      expect(body.blocks[1].elements[0]).not.toHaveProperty("style");
    });

    it("throws on API failure", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: false, error: "channel_not_found" }),
      });

      await expect(
        sendMessageWithBlocks("xoxb-token", "C999", "test", [
          { text: "OK", action_id: "test", value: "v" },
        ]),
      ).rejects.toThrow("Failed to send Slack Block Kit message");
    });
  });

  describe("updateMessage", () => {
    const originalFetch = global.fetch;

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it("updates message text and clears blocks", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true }),
      });

      await updateMessage("xoxb-token", "C123", "1234567890.123456", "Decision: Approved");

      expect(global.fetch).toHaveBeenCalledOnce();
      const [url, opts] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(url).toBe("https://slack.com/api/chat.update");
      const body = JSON.parse(opts.body);
      expect(body.channel).toBe("C123");
      expect(body.ts).toBe("1234567890.123456");
      expect(body.text).toBe("Decision: Approved");
      expect(body.blocks).toEqual([]);
    });

    it("throws on API failure", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: false, error: "message_not_found" }),
      });

      await expect(
        updateMessage("xoxb-token", "C123", "123.456", "text"),
      ).rejects.toThrow("Failed to update Slack message");
    });
  });
});
