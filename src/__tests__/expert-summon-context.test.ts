import { describe, it, expect } from "vitest";

/**
 * Tests for the per-client summon context model.
 *
 * In the per-client model:
 * - summonContext is passed in the setup-link POST body (not stored on the expert)
 * - The setup-link handler trims, caps at 2000, and stores on SetupToken
 * - Recently used contexts are saved to expert.recentSummonContexts (JSON array, max 10, deduped)
 */

/** Mirrors the setup-link handler's summonContext trimming */
function trimSummonContext(value: string | undefined): string | null {
  return value?.trim().slice(0, 2000) || null;
}

/** Mirrors the recentSummonContexts update logic */
function updateRecentContexts(existing: string[], newContext: string, max = 10): string[] {
  const deduped = [newContext, ...existing.filter((c) => c !== newContext)];
  return deduped.slice(0, max);
}

describe("Per-client summonContext \u2014 trimming", () => {
  it("passes through a normal string after trimming", () => {
    const result = trimSummonContext("Only summon me for critical decisions.");
    expect(result).toBe("Only summon me for critical decisions.");
  });

  it("trims whitespace", () => {
    const result = trimSummonContext("  some context  ");
    expect(result).toBe("some context");
  });

  it("truncates strings exceeding 2000 characters", () => {
    const long = "x".repeat(2500);
    const result = trimSummonContext(long);
    expect(result).toHaveLength(2000);
    expect(result).toBe("x".repeat(2000));
  });

  it("preserves strings at exactly 2000 characters", () => {
    const exact = "y".repeat(2000);
    const result = trimSummonContext(exact);
    expect(result).toBe(exact);
    expect(result).toHaveLength(2000);
  });

  it("converts empty string to null", () => {
    const result = trimSummonContext("");
    expect(result).toBeNull();
  });

  it("converts whitespace-only string to null", () => {
    const result = trimSummonContext("   ");
    expect(result).toBeNull();
  });

  it("converts undefined to null", () => {
    const result = trimSummonContext(undefined);
    expect(result).toBeNull();
  });

  it("preserves special characters without escaping", () => {
    const context = `Before any $() action; use 'single' & "double" quotes <safely>.`;
    const result = trimSummonContext(context);
    expect(result).toBe(context);
  });

  it("preserves newlines in context text", () => {
    const context = "Line 1: budget rules\nLine 2: safety rules";
    const result = trimSummonContext(context);
    expect(result).toBe(context);
  });

  it("truncates via JS string slice (UTF-16 code units)", () => {
    const context = "a".repeat(1998) + "\u{1F4B0}\u{1F6A8}";
    expect(context.length).toBe(2002);
    const result = trimSummonContext(context);
    expect(result).toHaveLength(2000);
    expect(result).toBe("a".repeat(1998) + "\u{1F4B0}");
  });
});

describe("recentSummonContexts \u2014 update logic", () => {
  it("prepends new context to empty list", () => {
    const result = updateRecentContexts([], "new context");
    expect(result).toEqual(["new context"]);
  });

  it("prepends new context to existing list", () => {
    const result = updateRecentContexts(["old"], "new");
    expect(result).toEqual(["new", "old"]);
  });

  it("deduplicates when same context is reused", () => {
    const result = updateRecentContexts(["first", "reused", "third"], "reused");
    expect(result).toEqual(["reused", "first", "third"]);
  });

  it("caps at 10 entries", () => {
    const existing = Array.from({ length: 10 }, (_, i) => `ctx-${i}`);
    const result = updateRecentContexts(existing, "new");
    expect(result).toHaveLength(10);
    expect(result[0]).toBe("new");
    expect(result[9]).toBe("ctx-8"); // ctx-9 is dropped
  });

  it("handles dedup + cap together", () => {
    const existing = Array.from({ length: 10 }, (_, i) => `ctx-${i}`);
    const result = updateRecentContexts(existing, "ctx-5");
    expect(result).toHaveLength(10);
    expect(result[0]).toBe("ctx-5");
    // ctx-5 was removed from position 5 and prepended, no items lost
    expect(result).not.toContain(undefined);
  });

  it("preserves order of remaining items", () => {
    const result = updateRecentContexts(["a", "b", "c", "d"], "c");
    expect(result).toEqual(["c", "a", "b", "d"]);
  });
});

/**
 * Mirrors the shell escaping used in setup page for OpenClaw commands.
 * Tests that summonContext is safe for shell interpolation.
 */
function shellEscape(s: string): string {
  return "'" + s.replace(/'/g, "'\\''") + "'";
}

describe("shellEscape \u2014 summonContext safety", () => {
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
    const result = shellEscape("'''");
    expect(result).toMatch(/^'/);
    expect(result).toMatch(/'$/);
    expect(result).toContain("\\");
    expect(result).toHaveLength(14);
  });
});
