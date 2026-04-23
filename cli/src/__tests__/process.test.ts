import { describe, it } from "node:test";
import * as assert from "node:assert";
import { spawn } from "child_process";
import {
  isProcessRunning,
  waitForProcessExit,
  killProcessTree,
} from "../lib/config";

function spawnLongRunningChild(): number {
  // Mirrors the `detached: true` + process-group semantics the daemon uses in
  // cli/src/commands/start.ts, so we exercise killProcessTree against the
  // same shape of process.
  const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000);"], {
    stdio: "ignore",
    detached: true,
  });
  child.unref();
  if (!child.pid) throw new Error("failed to spawn test child");
  return child.pid;
}

describe("process helpers", () => {
  it("isProcessRunning returns true for an alive pid and false for a dead one", async () => {
    const pid = spawnLongRunningChild();
    try {
      assert.strictEqual(isProcessRunning(pid), true);
    } finally {
      killProcessTree(pid, "SIGKILL");
      const exited = await waitForProcessExit(pid, 2_000);
      assert.strictEqual(exited, true);
    }
    assert.strictEqual(isProcessRunning(pid), false);
  });

  it("waitForProcessExit resolves true once the process exits", async () => {
    const pid = spawnLongRunningChild();
    setTimeout(() => killProcessTree(pid, "SIGTERM"), 100);
    const exited = await waitForProcessExit(pid, 3_000, 50);
    assert.strictEqual(exited, true);
  });

  it("waitForProcessExit resolves false if the process does not exit in time", async () => {
    const pid = spawnLongRunningChild();
    try {
      const exited = await waitForProcessExit(pid, 300, 50);
      assert.strictEqual(exited, false);
    } finally {
      killProcessTree(pid, "SIGKILL");
      await waitForProcessExit(pid, 2_000);
    }
  });

  it("killProcessTree is a no-op for an already-dead pid", async () => {
    const pid = spawnLongRunningChild();
    killProcessTree(pid, "SIGKILL");
    await waitForProcessExit(pid, 2_000);
    // Should not throw even though the process is gone.
    killProcessTree(pid, "SIGTERM");
    killProcessTree(pid, "SIGKILL");
    assert.strictEqual(isProcessRunning(pid), false);
  });
});
