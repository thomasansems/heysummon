import { describe, it, expect } from "vitest";
import { keyCreateSchema, keyUpdateSchema, CUSTOM_CLIENT_LABEL_MAX } from "@/lib/validations";

describe("clientChannel: 'custom' validation", () => {
  describe("keyCreateSchema", () => {
    it("accepts a valid free-text label", () => {
      const result = keyCreateSchema.safeParse({
        clientChannel: "custom",
        clientSubChannel: "n8n",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.clientChannel).toBe("custom");
        expect(result.data.clientSubChannel).toBe("n8n");
      }
    });

    it("trims the label", () => {
      const result = keyCreateSchema.safeParse({
        clientChannel: "custom",
        clientSubChannel: "   MyAgent   ",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.clientSubChannel).toBe("MyAgent");
      }
    });

    it("rejects an empty label", () => {
      const result = keyCreateSchema.safeParse({
        clientChannel: "custom",
        clientSubChannel: "",
      });
      expect(result.success).toBe(false);
    });

    it("rejects a whitespace-only label", () => {
      const result = keyCreateSchema.safeParse({
        clientChannel: "custom",
        clientSubChannel: "     ",
      });
      expect(result.success).toBe(false);
    });

    it("rejects a missing label", () => {
      const result = keyCreateSchema.safeParse({
        clientChannel: "custom",
      });
      expect(result.success).toBe(false);
    });

    it(`rejects a label longer than ${CUSTOM_CLIENT_LABEL_MAX} characters`, () => {
      const result = keyCreateSchema.safeParse({
        clientChannel: "custom",
        clientSubChannel: "a".repeat(CUSTOM_CLIENT_LABEL_MAX + 1),
      });
      expect(result.success).toBe(false);
    });

    it("accepts a label exactly at the max length", () => {
      const result = keyCreateSchema.safeParse({
        clientChannel: "custom",
        clientSubChannel: "a".repeat(CUSTOM_CLIENT_LABEL_MAX),
      });
      expect(result.success).toBe(true);
    });

    it("rejects labels with HTML angle brackets", () => {
      const result = keyCreateSchema.safeParse({
        clientChannel: "custom",
        clientSubChannel: "<script>",
      });
      expect(result.success).toBe(false);
    });

    it("rejects labels with control characters", () => {
      const result = keyCreateSchema.safeParse({
        clientChannel: "custom",
        clientSubChannel: "bad\x00label",
      });
      expect(result.success).toBe(false);
    });

    it("still enforces telegram/whatsapp for openclaw", () => {
      const ok = keyCreateSchema.safeParse({
        clientChannel: "openclaw",
        clientSubChannel: "telegram",
      });
      expect(ok.success).toBe(true);

      const bad = keyCreateSchema.safeParse({
        clientChannel: "openclaw",
        clientSubChannel: "discord",
      });
      expect(bad.success).toBe(false);
    });

    it("accepts all non-custom channels with no sub-channel", () => {
      for (const channel of ["claudecode", "codex", "gemini", "cursor"] as const) {
        const result = keyCreateSchema.safeParse({ clientChannel: channel });
        expect(result.success).toBe(true);
      }
    });
  });

  describe("keyUpdateSchema", () => {
    it("accepts a valid custom label", () => {
      const result = keyUpdateSchema.safeParse({
        clientChannel: "custom",
        clientSubChannel: "Paperclip",
      });
      expect(result.success).toBe(true);
    });

    it("rejects an empty custom label on update", () => {
      const result = keyUpdateSchema.safeParse({
        clientChannel: "custom",
        clientSubChannel: "",
      });
      expect(result.success).toBe(false);
    });
  });
});
