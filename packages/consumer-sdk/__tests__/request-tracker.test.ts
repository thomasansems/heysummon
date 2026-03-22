import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { RequestTracker } from "../src/request-tracker.js";

let tempDir: string;
let tracker: RequestTracker;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "hs-tracker-test-"));
  tracker = new RequestTracker(tempDir);
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe("RequestTracker", () => {
  it("tracks a request with refCode", () => {
    tracker.track("req1", "HS-001");
    expect(tracker.getRefCode("req1")).toBe("HS-001");
  });

  it("tracks a request with provider", () => {
    tracker.track("req1", "HS-001", "Thomas");
    expect(tracker.getProvider("req1")).toBe("Thomas");
  });

  it("returns null for unknown request", () => {
    expect(tracker.getRefCode("unknown")).toBeNull();
    expect(tracker.getProvider("unknown")).toBeNull();
  });

  it("removes a tracked request", () => {
    tracker.track("req1", "HS-001", "Thomas");
    tracker.remove("req1");
    expect(tracker.getRefCode("req1")).toBeNull();
    expect(tracker.getProvider("req1")).toBeNull();
  });

  it("lists active requests", () => {
    tracker.track("req1", "HS-001", "Thomas");
    tracker.track("req2", "HS-002");

    const active = tracker.listActive();
    expect(active).toHaveLength(2);
    expect(active.find((r) => r.requestId === "req1")?.provider).toBe(
      "Thomas"
    );
    expect(active.find((r) => r.requestId === "req2")?.refCode).toBe("HS-002");
  });

  it("creates directory on construction", () => {
    const nested = join(tempDir, "a", "b", "c");
    const t = new RequestTracker(nested);
    t.track("req1", "HS-001");
    expect(t.getRefCode("req1")).toBe("HS-001");
  });

  it("ignores .provider files in listActive", () => {
    tracker.track("req1", "HS-001", "Thomas");
    const active = tracker.listActive();
    // Should only list req1, not req1.provider
    expect(active).toHaveLength(1);
  });

  it("remove is idempotent", () => {
    tracker.remove("nonexistent");
    // should not throw
  });
});
