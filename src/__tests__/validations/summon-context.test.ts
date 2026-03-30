import { describe, it, expect } from "vitest";
import { providerUpdateSchema } from "@/lib/validations";

describe("providerUpdateSchema — summonContext removed (per-client model)", () => {
  it("does not accept summonContext field", () => {
    const result = providerUpdateSchema.safeParse({
      summonContext: "Only summon for critical decisions.",
    });
    // With strict Zod schema, unknown fields are stripped but still succeed
    // Verify the field is not in the parsed output
    expect(result.success).toBe(true);
    if (result.success) {
      expect("summonContext" in result.data).toBe(false);
    }
  });

  it("still accepts other valid provider fields", () => {
    const result = providerUpdateSchema.safeParse({
      name: "Test Provider",
      isActive: true,
      tagline: "Expert helper",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Test Provider");
      expect(result.data.isActive).toBe(true);
      expect(result.data.tagline).toBe("Expert helper");
    }
  });

  it("accepts empty object", () => {
    const result = providerUpdateSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("still validates other fields correctly", () => {
    const result = providerUpdateSchema.safeParse({
      tagline: "a".repeat(161), // exceeds 160 limit
    });
    expect(result.success).toBe(false);
  });
});
