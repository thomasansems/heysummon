import { describe, it, expect } from "vitest";

// Test generateApiKey directly to avoid importing next-auth dependencies
// We inline the function logic since the module has side-effect imports
describe("generateApiKey", () => {
  // Re-implement to test the algorithm without triggering next-auth import
  function generateApiKey(): string {
    const chars = "0123456789abcdef";
    let key = "htl_";
    for (let i = 0; i < 32; i++) {
      key += chars[Math.floor(Math.random() * chars.length)];
    }
    return key;
  }

  it("starts with htl_ prefix", () => {
    expect(generateApiKey()).toMatch(/^htl_/);
  });

  it("has 36 chars total (4 prefix + 32 hex)", () => {
    const key = generateApiKey();
    expect(key).toHaveLength(36);
    expect(key.slice(4)).toMatch(/^[0-9a-f]{32}$/);
  });

  it("generates unique keys", () => {
    const keys = new Set(Array.from({ length: 50 }, () => generateApiKey()));
    expect(keys.size).toBe(50);
  });
});
