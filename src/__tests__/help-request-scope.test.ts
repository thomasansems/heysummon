import { describe, it, expect } from "vitest";
import { nonProbe, NON_PROBE_FILTER } from "@/lib/help-request-scope";

describe("help-request-scope", () => {
  it("NON_PROBE_FILTER excludes probe rows", () => {
    expect(NON_PROBE_FILTER).toEqual({ probe: false });
  });

  it("nonProbe() injects probe: false into an empty where", () => {
    expect(nonProbe()).toEqual({ probe: false });
  });

  it("nonProbe(where) preserves caller fields and adds probe: false", () => {
    const out = nonProbe({ expertId: "u-1", status: "pending" });
    expect(out).toEqual({
      expertId: "u-1",
      status: "pending",
      probe: false,
    });
  });

  it("nonProbe overrides any probe value the caller passed in", () => {
    // The helper must always force probe: false regardless of what the
    // caller put in. This is the leak-prevention contract.
    const out = nonProbe({ probe: true } as unknown as Record<string, unknown>);
    expect(out.probe).toBe(false);
  });
});
