import { describe, it, expect } from "vitest";
import { providerUpdateSchema } from "@/lib/validations";

describe("providerUpdateSchema — summonContext", () => {
  it("accepts a valid summonContext string", () => {
    const result = providerUpdateSchema.safeParse({
      summonContext: "Only summon me when you have tried at least 3 different approaches.",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.summonContext).toBe(
        "Only summon me when you have tried at least 3 different approaches."
      );
    }
  });

  it("accepts summonContext at exactly 500 characters", () => {
    const context = "a".repeat(500);
    const result = providerUpdateSchema.safeParse({ summonContext: context });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.summonContext).toBe(context);
    }
  });

  it("rejects summonContext exceeding 500 characters", () => {
    const context = "a".repeat(501);
    const result = providerUpdateSchema.safeParse({ summonContext: context });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues[0];
      expect(issue.path).toEqual(["summonContext"]);
      expect(issue.code).toBe("too_big");
    }
  });

  it("accepts null summonContext", () => {
    const result = providerUpdateSchema.safeParse({ summonContext: null });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.summonContext).toBeNull();
    }
  });

  it("accepts undefined summonContext (field omitted)", () => {
    const result = providerUpdateSchema.safeParse({ isActive: true });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.summonContext).toBeUndefined();
    }
  });

  it("accepts empty object without summonContext", () => {
    const result = providerUpdateSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.summonContext).toBeUndefined();
    }
  });

  it("accepts empty string (API layer converts to null)", () => {
    const result = providerUpdateSchema.safeParse({ summonContext: "" });
    expect(result.success).toBe(true);
    if (result.success) {
      // Zod passes empty string; the API PATCH handler converts "" to null
      expect(result.data.summonContext).toBe("");
    }
  });

  it("rejects non-string types", () => {
    const result = providerUpdateSchema.safeParse({ summonContext: 42 });
    expect(result.success).toBe(false);
  });

  it("preserves special characters in summonContext", () => {
    const context = `Summon me before any $100+ action. Use "caution" with 'quotes' & <tags>.`;
    const result = providerUpdateSchema.safeParse({ summonContext: context });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.summonContext).toBe(context);
    }
  });

  it("preserves unicode characters", () => {
    const context = "Rufe mich nur bei kritischen Entscheidungen an. Kosten uber 100EUR.";
    const result = providerUpdateSchema.safeParse({ summonContext: context });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.summonContext).toBe(context);
    }
  });

  it("coexists with other provider fields", () => {
    const result = providerUpdateSchema.safeParse({
      name: "Test Provider",
      isActive: true,
      tagline: "Expert helper",
      summonContext: "Safety-first: always summon before irreversible actions.",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Test Provider");
      expect(result.data.summonContext).toBe(
        "Safety-first: always summon before irreversible actions."
      );
    }
  });
});
