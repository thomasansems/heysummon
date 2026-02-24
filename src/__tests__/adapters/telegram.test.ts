import { describe, it, expect } from "vitest";
import { telegramAdapter } from "@/lib/adapters/telegram";

describe("Telegram Adapter", () => {
  describe("validateConfig", () => {
    it("rejects empty config", () => {
      const result = telegramAdapter.validateConfig(null);
      expect(result.valid).toBe(false);
    });

    it("rejects missing botToken", () => {
      const result = telegramAdapter.validateConfig({});
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain("Bot token");
      }
    });

    it("rejects empty botToken", () => {
      const result = telegramAdapter.validateConfig({ botToken: "" });
      expect(result.valid).toBe(false);
    });

    it("accepts valid config with botToken", () => {
      const result = telegramAdapter.validateConfig({ botToken: "123456:ABC-DEF" });
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.config).toEqual({
          botToken: "123456:ABC-DEF",
          botUsername: undefined,
          webhookSecret: undefined,
        });
      }
    });

    it("accepts config with all fields", () => {
      const result = telegramAdapter.validateConfig({
        botToken: "123456:ABC-DEF",
        botUsername: "test_bot",
        webhookSecret: "secret123",
      });
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.config).toEqual({
          botToken: "123456:ABC-DEF",
          botUsername: "test_bot",
          webhookSecret: "secret123",
        });
      }
    });

    it("trims botToken whitespace", () => {
      const result = telegramAdapter.validateConfig({ botToken: "  123456:ABC  " });
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.config).toHaveProperty("botToken", "123456:ABC");
      }
    });
  });
});
