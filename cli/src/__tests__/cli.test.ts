import { describe, it } from "node:test";
import * as assert from "node:assert";
import { execSync } from "child_process";
import * as path from "path";

const CLI_PATH = path.join(__dirname, "..", "..", "bin", "cli.js");

describe("CLI", () => {
  it("prints version with --version flag", () => {
    const output = execSync(`node "${CLI_PATH}" --version`, {
      encoding: "utf-8",
    }).trim();
    assert.match(output, /^\d+\.\d+\.\d+$/);
  });

  it("prints version with -v flag", () => {
    const output = execSync(`node "${CLI_PATH}" -v`, {
      encoding: "utf-8",
    }).trim();
    assert.match(output, /^\d+\.\d+\.\d+$/);
  });

  it("prints help with --help flag", () => {
    const output = execSync(`node "${CLI_PATH}" --help`, {
      encoding: "utf-8",
    });
    assert.ok(output.includes("HeySummon CLI"));
    assert.ok(output.includes("Usage:"));
    assert.ok(output.includes("Commands:"));
    assert.ok(output.includes("init"));
    assert.ok(output.includes("start"));
    assert.ok(output.includes("stop"));
    assert.ok(output.includes("status"));
    assert.ok(output.includes("update"));
  });

  it("prints help with -h flag", () => {
    const output = execSync(`node "${CLI_PATH}" -h`, {
      encoding: "utf-8",
    });
    assert.ok(output.includes("HeySummon CLI"));
  });

  it("exits with error for unknown commands", () => {
    assert.throws(() => {
      execSync(`node "${CLI_PATH}" foobar`, {
        encoding: "utf-8",
        stdio: "pipe",
      });
    });
  });
});
