import { describe, it, expect } from "vitest";
import { openClawAdapter } from "@/lib/adapters/openclaw";

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
});
