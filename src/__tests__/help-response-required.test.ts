import { describe, it, expect } from "vitest";
import { helpCreateSchema } from "@/lib/validations";

describe("helpCreateSchema — responseRequired field", () => {
  const baseBody = { apiKey: "hs_cli_test" };

  it("defaults responseRequired to true when omitted", () => {
    const parsed = helpCreateSchema.parse(baseBody);
    expect(parsed.responseRequired).toBe(true);
  });

  it("accepts explicit responseRequired: true", () => {
    const parsed = helpCreateSchema.parse({
      ...baseBody,
      responseRequired: true,
    });
    expect(parsed.responseRequired).toBe(true);
  });

  it("accepts explicit responseRequired: false (notification mode)", () => {
    const parsed = helpCreateSchema.parse({
      ...baseBody,
      responseRequired: false,
    });
    expect(parsed.responseRequired).toBe(false);
  });

  it("rejects non-boolean responseRequired (string 'false')", () => {
    const result = helpCreateSchema.safeParse({
      ...baseBody,
      responseRequired: "false",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) =>
        i.path.includes("responseRequired")
      );
      expect(issue).toBeDefined();
    }
  });

  it("rejects non-boolean responseRequired (number)", () => {
    const result = helpCreateSchema.safeParse({
      ...baseBody,
      responseRequired: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-boolean responseRequired (null)", () => {
    const result = helpCreateSchema.safeParse({
      ...baseBody,
      responseRequired: null,
    });
    expect(result.success).toBe(false);
  });

  it("does not coerce truthy/falsy values — strict boolean only", () => {
    expect(
      helpCreateSchema.safeParse({ ...baseBody, responseRequired: 1 }).success
    ).toBe(false);
    expect(
      helpCreateSchema.safeParse({ ...baseBody, responseRequired: "" }).success
    ).toBe(false);
  });

  it("preserves other fields when responseRequired is set", () => {
    const parsed = helpCreateSchema.parse({
      ...baseBody,
      question: "Deploy finished",
      questionPreview: "Deploy finished",
      responseRequired: false,
    });
    expect(parsed).toMatchObject({
      apiKey: "hs_cli_test",
      question: "Deploy finished",
      questionPreview: "Deploy finished",
      responseRequired: false,
    });
  });
});
