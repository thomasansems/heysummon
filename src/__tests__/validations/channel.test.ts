import { describe, it, expect } from "vitest";
import { channelCreateSchema, channelUpdateSchema } from "@/lib/validations";

describe("Channel Validation Schemas", () => {
  describe("channelCreateSchema", () => {
    it("requires profileId", () => {
      const result = channelCreateSchema.safeParse({ type: "openclaw", name: "Test" });
      expect(result.success).toBe(false);
    });

    it("requires valid type", () => {
      const result = channelCreateSchema.safeParse({ profileId: "abc", type: "whatsapp", name: "Test" });
      expect(result.success).toBe(false);
    });

    it("requires name", () => {
      const result = channelCreateSchema.safeParse({ profileId: "abc", type: "openclaw" });
      expect(result.success).toBe(false);
    });

    it("accepts valid openclaw input", () => {
      const result = channelCreateSchema.safeParse({
        profileId: "abc",
        type: "openclaw",
        name: "My Channel",
        config: { apiKey: "oc_123" },
      });
      expect(result.success).toBe(true);
    });

    it("accepts valid telegram input", () => {
      const result = channelCreateSchema.safeParse({
        profileId: "abc",
        type: "telegram",
        name: "Bot",
        config: { botToken: "123:ABC" },
      });
      expect(result.success).toBe(true);
    });

    it("defaults config to empty object", () => {
      const result = channelCreateSchema.safeParse({
        profileId: "abc",
        type: "openclaw",
        name: "Test",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.config).toEqual({});
      }
    });

    it("trims name", () => {
      const result = channelCreateSchema.safeParse({
        profileId: "abc",
        type: "openclaw",
        name: "  My Channel  ",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("My Channel");
      }
    });
  });

  describe("channelUpdateSchema", () => {
    it("accepts empty object", () => {
      const result = channelUpdateSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it("accepts name update", () => {
      const result = channelUpdateSchema.safeParse({ name: "New Name" });
      expect(result.success).toBe(true);
    });

    it("accepts isActive update", () => {
      const result = channelUpdateSchema.safeParse({ isActive: false });
      expect(result.success).toBe(true);
    });

    it("accepts config update", () => {
      const result = channelUpdateSchema.safeParse({ config: { apiKey: "new_key" } });
      expect(result.success).toBe(true);
    });
  });
});
