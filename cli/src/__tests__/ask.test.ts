import { describe, it } from "node:test";
import * as assert from "node:assert";
import { parseAskArgs, parseDuration } from "../commands/ask";

describe("ask", () => {
  describe("parseDuration", () => {
    it("parses plain seconds", () => {
      assert.strictEqual(parseDuration("30"), 30);
      assert.strictEqual(parseDuration("30s"), 30);
    });

    it("parses minutes", () => {
      assert.strictEqual(parseDuration("5m"), 300);
      assert.strictEqual(parseDuration("10min"), 600);
    });

    it("parses hours", () => {
      assert.strictEqual(parseDuration("1h"), 3600);
      assert.strictEqual(parseDuration("2hrs"), 7200);
    });

    it("throws on invalid input", () => {
      assert.throws(() => parseDuration("10x"));
      assert.throws(() => parseDuration("abc"));
      assert.throws(() => parseDuration(""));
    });
  });

  describe("parseAskArgs", () => {
    it("accepts a single positional question", () => {
      const result = parseAskArgs(["Proceed?"]);
      assert.ok(!("error" in result));
      if ("error" in result) return;
      assert.strictEqual(result.question, "Proceed?");
      assert.strictEqual(result.timeoutSeconds, 300);
      assert.strictEqual(result.quiet, false);
      assert.strictEqual(result.channel, undefined);
    });

    it("parses all flags together", () => {
      const result = parseAskArgs([
        "Deploy?",
        "--timeout",
        "1h",
        "--channel",
        "oncall",
        "-q",
        "--require",
        "approve",
      ]);
      assert.ok(!("error" in result));
      if ("error" in result) return;
      assert.strictEqual(result.question, "Deploy?");
      assert.strictEqual(result.timeoutSeconds, 3600);
      assert.strictEqual(result.channel, "oncall");
      assert.strictEqual(result.quiet, true);
    });

    it("rejects empty question", () => {
      const result = parseAskArgs([""]);
      assert.ok("error" in result);
      assert.match((result as { error: string }).error, /empty question/);
    });

    it("rejects missing question", () => {
      const result = parseAskArgs(["--timeout", "5m"]);
      assert.ok("error" in result);
    });

    it("rejects whitespace-only question", () => {
      const result = parseAskArgs(["   "]);
      assert.ok("error" in result);
    });

    it("rejects unknown flags", () => {
      const result = parseAskArgs(["Proceed?", "--bogus"]);
      assert.ok("error" in result);
      assert.match((result as { error: string }).error, /unknown flag/);
    });

    it("rejects unknown --require mode", () => {
      const result = parseAskArgs(["Proceed?", "--require", "force"]);
      assert.ok("error" in result);
      assert.match((result as { error: string }).error, /--require/);
    });

    it("rejects invalid --timeout value", () => {
      const result = parseAskArgs(["Proceed?", "--timeout", "forever"]);
      assert.ok("error" in result);
    });

    it("accepts --quiet as alias for -q", () => {
      const result = parseAskArgs(["Proceed?", "--quiet"]);
      assert.ok(!("error" in result));
      if ("error" in result) return;
      assert.strictEqual(result.quiet, true);
    });
  });
});
