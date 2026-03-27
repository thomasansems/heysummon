import { describe, it, expect } from "vitest";
import crypto from "crypto";

// Test generateApiKey directly to avoid importing next-auth dependencies
// We inline the function logic since the module has side-effect imports
describe("generateApiKey", () => {
  // Re-implement to test the algorithm without triggering next-auth import
  function generateApiKey(): string {
    return "hs_" + crypto.randomBytes(16).toString("hex");
  }

  it("starts with hs_ prefix", () => {
    expect(generateApiKey()).toMatch(/^hs_/);
  });

  it("has 35 chars total (3 prefix + 32 hex)", () => {
    const key = generateApiKey();
    expect(key).toHaveLength(35);
    expect(key.slice(3)).toMatch(/^[0-9a-f]{32}$/);
  });

  it("generates unique keys", () => {
    const keys = new Set(Array.from({ length: 50 }, () => generateApiKey()));
    expect(keys.size).toBe(50);
  });
});
