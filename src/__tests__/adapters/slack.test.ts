import { describe, it, expect } from "vitest";
import { slackAdapter } from "@/lib/adapters/slack";
import { verifySlackSignature } from "@/lib/adapters/slack";
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
});
