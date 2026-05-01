import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  telegramAdapter,
  sendMessage,
  sendMessageWithButtons,
  answerCallbackQuery,
  editMessageText,
} from "@/lib/adapters/telegram";

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

  describe("sendMessageWithButtons", () => {
    const originalFetch = global.fetch;

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it("sends InlineKeyboardMarkup with approval buttons", async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: true, text: async () => "" });

      await sendMessageWithButtons("123:TOKEN", "42", "Approve this?", [
        [
          { text: "Approve", callback_data: "approve:req-1" },
          { text: "Deny", callback_data: "deny:req-1" },
        ],
      ]);

      expect(global.fetch).toHaveBeenCalledOnce();
      const [url, opts] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(url).toBe("https://api.telegram.org/bot123:TOKEN/sendMessage");
      const body = JSON.parse(opts.body);
      expect(body.chat_id).toBe("42");
      expect(body.text).toBe("Approve this?");
      expect(body.parse_mode).toBe("Markdown");
      expect(body.reply_markup).toEqual({
        inline_keyboard: [
          [
            { text: "Approve", callback_data: "approve:req-1" },
            { text: "Deny", callback_data: "deny:req-1" },
          ],
        ],
      });
    });

    it("throws on API failure", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        text: async () => "Bad Request",
      });

      await expect(
        sendMessageWithButtons("123:TOKEN", "42", "test", [[{ text: "OK", callback_data: "ok" }]])
      ).rejects.toThrow("Failed to send Telegram message with buttons");
    });

    it("renders notification block with single Acknowledge button (no emoji chrome)", async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: true, text: async () => "" });

      const headerMsg = [
        `*Notification* from Acme`,
        `\n"ship report ready"\n`,
      ].join("\n");
      await sendMessageWithButtons("123:TOKEN", "42", headerMsg, [
        [{ text: "Acknowledge", callback_data: "ack:req-ntf-1" }],
      ]);

      const body = JSON.parse(
        (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body,
      );
      expect(body.text).toContain("*Notification* from Acme");
      expect(body.text).not.toContain("/reply");
      expect(body.text).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
      expect(body.reply_markup).toEqual({
        inline_keyboard: [
          [{ text: "Acknowledge", callback_data: "ack:req-ntf-1" }],
        ],
      });
      expect(body.reply_markup.inline_keyboard[0]).toHaveLength(1);
    });
  });

  describe("answerCallbackQuery", () => {
    const originalFetch = global.fetch;

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it("answers a callback query with text", async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: true, text: async () => "" });

      await answerCallbackQuery("123:TOKEN", "cbq-1", "Approved");

      const [url, opts] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(url).toBe("https://api.telegram.org/bot123:TOKEN/answerCallbackQuery");
      const body = JSON.parse(opts.body);
      expect(body.callback_query_id).toBe("cbq-1");
      expect(body.text).toBe("Approved");
    });

    it("answers without text", async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: true, text: async () => "" });

      await answerCallbackQuery("123:TOKEN", "cbq-2");

      const body = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
      expect(body.text).toBeUndefined();
    });
  });

  describe("editMessageText", () => {
    const originalFetch = global.fetch;

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it("edits message text and removes inline keyboard", async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: true, text: async () => "" });

      await editMessageText("123:TOKEN", "42", 999, "Updated text");

      const [url, opts] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(url).toBe("https://api.telegram.org/bot123:TOKEN/editMessageText");
      const body = JSON.parse(opts.body);
      expect(body.chat_id).toBe("42");
      expect(body.message_id).toBe(999);
      expect(body.text).toBe("Updated text");
      expect(body.parse_mode).toBe("Markdown");
    });

    it("throws on API failure", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        text: async () => "Message not found",
      });

      await expect(editMessageText("123:TOKEN", "42", 999, "text")).rejects.toThrow(
        "Failed to edit Telegram message"
      );
    });
  });
});
