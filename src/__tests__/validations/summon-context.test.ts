import { describe, it, expect } from "vitest";
import { expertUpdateSchema } from "@/lib/validations";

describe("expertUpdateSchema \u2014 summonContext removed (per-client model)", () => {
  it("does not accept summonContext field", () => {
    const result = expertUpdateSchema.safeParse({
      summonContext: "Only summon for critical decisions.",
    });
    // With strict Zod schema, unknown fields are stripped but still succeed
    // Verify the field is not in the parsed output
    expect(result.success).toBe(true);
    if (result.success) {
      expect("summonContext" in result.data).toBe(false);
    }
  });

  it("still accepts other valid expert fields", () => {
    const result = expertUpdateSchema.safeParse({
      name: "Test Expert",
      isActive: true,
      tagline: "Expert helper",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Test Expert");
      expect(result.data.isActive).toBe(true);
      expect(result.data.tagline).toBe("Expert helper");
    }
  });

  it("accepts empty object", () => {
    const result = expertUpdateSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("still validates other fields correctly", () => {
    const result = expertUpdateSchema.safeParse({
      tagline: "a".repeat(161), // exceeds 160 limit
    });
    expect(result.success).toBe(false);
  });
});
