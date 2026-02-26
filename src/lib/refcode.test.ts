import { describe, it, expect } from "vitest";
import { generateRefCode } from "./refcode";

describe("generateRefCode", () => {
  it("returns HS-XXXXXXXX format", () => {
    const code = generateRefCode();
    expect(code).toMatch(/^HS-[A-Z0-9]{8}$/);
  });

  it("generates codes with 8 uppercase alphanumeric chars", () => {
    for (let i = 0; i < 20; i++) {
      const code = generateRefCode();
      expect(code.slice(3)).toMatch(/^[A-Z0-9]{8}$/);
    }
  });

  it("generates 100 codes with no duplicates (statistical)", () => {
    const codes = new Set<string>();
    for (let i = 0; i < 100; i++) {
      codes.add(generateRefCode());
    }
    // With 36^8 = 2.8T possible codes, 100 should be unique
    expect(codes.size).toBe(100);
  });
});
