import { describe, it, expect } from "vitest";
import { SUMMON_CONTEXT_PRESETS } from "@/lib/summon-context-presets";
import { buildSetupCopyText } from "@/lib/setup-copy-text";

/**
 * Tests for the dashboard wizard summoning context feature.
 *
 * These are unit tests for the data logic that the wizard uses --
 * preset selection, text truncation, copy text building, and
 * recent context filtering.
 */

/** Mirrors the 2000-char cap enforced by the textarea onChange */
function capContextInput(value: string): string {
  return value.slice(0, 2000);
}

/** Mirrors the recentNonPreset filter in the wizard */
function filterRecentContexts(
  recentContexts: string[],
  maxShown = 5,
): string[] {
  const presetTexts = SUMMON_CONTEXT_PRESETS.map((p) => p.text);
  return recentContexts
    .filter((c) => !presetTexts.includes(c))
    .slice(0, maxShown);
}

describe("Dashboard wizard context — preset selection", () => {
  it("has three presets available", () => {
    expect(SUMMON_CONTEXT_PRESETS).toHaveLength(3);
  });

  it("each preset has a label and text", () => {
    for (const preset of SUMMON_CONTEXT_PRESETS) {
      expect(preset.label).toBeTruthy();
      expect(preset.text).toBeTruthy();
      expect(preset.text.length).toBeLessThanOrEqual(2000);
    }
  });

  it("preset labels are unique", () => {
    const labels = SUMMON_CONTEXT_PRESETS.map((p) => p.label);
    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe("Dashboard wizard context — input constraints", () => {
  it("caps text at 2000 characters", () => {
    const long = "a".repeat(2500);
    expect(capContextInput(long)).toHaveLength(2000);
  });

  it("passes through text under 2000 characters unchanged", () => {
    const short = "Only summon me for critical decisions.";
    expect(capContextInput(short)).toBe(short);
  });

  it("handles empty string", () => {
    expect(capContextInput("")).toBe("");
  });
});

describe("Dashboard wizard context — copy text building", () => {
  const testUrl = "https://app.example.com/setup/abc123";

  it("builds text block without context when empty", () => {
    const text = buildSetupCopyText(testUrl, "");
    expect(text).toContain("HeySummon Setup");
    expect(text).toContain(testUrl);
    expect(text).toContain("valid 24 hours");
    expect(text).not.toContain("Summoning guidelines");
  });

  it("builds text block with context when set", () => {
    const context = "Only summon for architecture decisions.";
    const text = buildSetupCopyText(testUrl, context);
    expect(text).toContain("HeySummon Setup");
    expect(text).toContain("Summoning guidelines:");
    expect(text).toContain(context);
    expect(text).toContain(testUrl);
  });

  it("includes marketplace install instructions", () => {
    const text = buildSetupCopyText(testUrl, "");
    expect(text).toContain("/plugin marketplace add");
    expect(text).toContain("/plugin install heysummon@client");
    expect(text).toContain(`/heysummon:setup ${testUrl}`);
  });

  it("includes curl fallback with command endpoint", () => {
    const text = buildSetupCopyText(testUrl, "");
    expect(text).toContain("api/v1/setup/abc123/command");
    expect(text).toContain("jq -r '.installCommand'");
  });

  it("trims whitespace from context in copy text", () => {
    const text = buildSetupCopyText(testUrl, "  padded context  ");
    expect(text).toContain("padded context");
    expect(text).not.toContain("  padded context  ");
  });

  it("skips guidelines section for whitespace-only context", () => {
    const text = buildSetupCopyText(testUrl, "   ");
    expect(text).not.toContain("Summoning guidelines");
  });
});

describe("Dashboard wizard context — recent context filtering", () => {
  it("filters out preset texts from recent contexts", () => {
    const recent = [
      SUMMON_CONTEXT_PRESETS[0].text,
      "Custom context A",
      "Custom context B",
    ];
    const filtered = filterRecentContexts(recent);
    expect(filtered).toEqual(["Custom context A", "Custom context B"]);
  });

  it("returns at most 5 items", () => {
    const recent = Array.from({ length: 10 }, (_, i) => `Context ${i}`);
    const filtered = filterRecentContexts(recent);
    expect(filtered).toHaveLength(5);
  });

  it("returns empty array when all are presets", () => {
    const recent = SUMMON_CONTEXT_PRESETS.map((p) => p.text);
    const filtered = filterRecentContexts(recent);
    expect(filtered).toEqual([]);
  });

  it("returns empty array for empty input", () => {
    expect(filterRecentContexts([])).toEqual([]);
  });

  it("preserves order of recent contexts", () => {
    const recent = ["First", "Second", "Third"];
    const filtered = filterRecentContexts(recent);
    expect(filtered).toEqual(["First", "Second", "Third"]);
  });
});
