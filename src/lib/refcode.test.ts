import { describe, it, expect } from "vitest";
import { generateRefCode } from "./refcode";

describe("generateRefCode", () => {
  it("returns HTL-XXXX format", () => {
    const code = generateRefCode();
    expect(code).toMatch(/^HTL-[A-Z0-9]{4}$/);
  });

  it("generates codes with 4 uppercase alphanumeric chars", () => {
    for (let i = 0; i < 20; i++) {
      const code = generateRefCode();
      expect(code.slice(4)).toMatch(/^[A-Z0-9]{4}$/);
    }
  });

  it("generates 100 codes with no duplicates (statistical)", () => {
    const codes = new Set<string>();
    for (let i = 0; i < 100; i++) {
      codes.add(generateRefCode());
    }
    // With 36^4 = 1.6M possible codes, 100 should be unique
    expect(codes.size).toBe(100);
  });
});
