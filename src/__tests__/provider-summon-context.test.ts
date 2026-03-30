import { describe, it, expect } from "vitest";

/**
 * Tests for summonContext data transformation logic in the provider PATCH handler.
 *
 * The PATCH /api/providers/:id handler applies this transformation:
 *   (body.summonContext as string)?.slice(0, 500) || null
 *
 * This test suite validates that transformation independently of the HTTP layer.
 */

/** Mirrors the PATCH handler's summonContext transformation */
function transformSummonContext(value: unknown): string | null {
  return (value as string)?.slice(0, 500) || null;
}

describe("Provider PATCH — summonContext transformation", () => {
  it("passes through a normal string", () => {
    const result = transformSummonContext("Only summon me for critical decisions.");
    expect(result).toBe("Only summon me for critical decisions.");
  });

  it("truncates strings exceeding 500 characters", () => {
    const long = "x".repeat(600);
    const result = transformSummonContext(long);
    expect(result).toHaveLength(500);
    expect(result).toBe("x".repeat(500));
  });

  it("preserves strings at exactly 500 characters", () => {
    const exact = "y".repeat(500);
    const result = transformSummonContext(exact);
    expect(result).toBe(exact);
    expect(result).toHaveLength(500);
  });

  it("converts empty string to null", () => {
    const result = transformSummonContext("");
    expect(result).toBeNull();
  });

  it("converts null to null", () => {
    const result = transformSummonContext(null);
    expect(result).toBeNull();
  });

  it("converts undefined to null", () => {
    const result = transformSummonContext(undefined);
    expect(result).toBeNull();
  });

  it("preserves special characters without escaping", () => {
    const context = `Before any $() action; use 'single' & "double" quotes <safely>.`;
    const result = transformSummonContext(context);
    expect(result).toBe(context);
  });

  it("preserves newlines in context text", () => {
    const context = "Line 1: budget rules\nLine 2: safety rules";
    const result = transformSummonContext(context);
    expect(result).toBe(context);
  });

  it("truncates via JS string slice (UTF-16 code units)", () => {
    // Emoji like U+1F4B0 takes 2 UTF-16 code units (surrogate pair)
    // 498 ASCII + 1 emoji (2 units) = 500 code units
    const context = "a".repeat(498) + "\u{1F4B0}\u{1F6A8}";
    expect(context.length).toBe(502); // 498 + 2 + 2
    const result = transformSummonContext(context);
    // slice(0, 500) keeps first 500 code units: 498 'a's + first emoji
    expect(result).toHaveLength(500);
    expect(result).toBe("a".repeat(498) + "\u{1F4B0}");
  });
});

/**
 * Mirrors the shell escaping used in setup page for OpenClaw commands.
 * Tests that summonContext is safe for shell interpolation.
 */
function shellEscape(s: string): string {
  return "'" + s.replace(/'/g, "'\\''") + "'";
}

describe("shellEscape — summonContext safety", () => {
  it("wraps simple text in single quotes", () => {
    expect(shellEscape("hello world")).toBe("'hello world'");
  });

  it("escapes single quotes", () => {
    expect(shellEscape("don't stop")).toBe("'don'\\''t stop'");
  });

  it("prevents command injection via $() syntax", () => {
    const malicious = "$(rm -rf /)";
    const escaped = shellEscape(malicious);
    expect(escaped).toBe("'$(rm -rf /)'");
    // Inside single quotes, $() is literal, not expanded
    expect(escaped).not.toContain("\\$");
  });

  it("prevents backtick injection", () => {
    const malicious = "`whoami`";
    const escaped = shellEscape(malicious);
    expect(escaped).toBe("'`whoami`'");
  });

  it("handles empty string", () => {
    expect(shellEscape("")).toBe("''");
  });

  it("handles string with only single quotes", () => {
    // Input: '''  (3 single quotes)
    // Each ' becomes '\'' in the replace, then wrapped in outer quotes
    const result = shellEscape("'''");
    // Verify structure: starts and ends with quote, contains escaped sequences
    expect(result).toMatch(/^'/);
    expect(result).toMatch(/'$/);
    expect(result).toContain("\\");
    // Verify the exact length: ' + ('\'' * 3) + ' = 1 + 12 + 1 = 14
    expect(result).toHaveLength(14);
  });
});
