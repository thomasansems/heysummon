import { execSync } from "child_process";
import {
  readPid,
  removePid,
  isProcessRunning,
  waitForProcessExit,
  killProcessTree,
} from "../lib/config";

const GRACEFUL_EXIT_TIMEOUT_MS = 10_000;
const FORCE_EXIT_TIMEOUT_MS = 3_000;

export async function stop(): Promise<void> {
  // Check for pm2 first
  try {
    execSync("pm2 describe heysummon", { stdio: "pipe" });
    console.log("  Stopping HeySummon (pm2)...");
    execSync("pm2 stop heysummon", { stdio: "inherit" });
    execSync("pm2 delete heysummon", { stdio: "inherit" });
    console.log("  HeySummon stopped");
    return;
  } catch {
    // Not managed by pm2, check PID file
  }

  const pid = readPid();
  if (!pid) {
    console.log("  HeySummon is not running (no PID file found)");
    return;
  }

  if (!isProcessRunning(pid)) {
    console.log("  HeySummon is not running (stale PID file)");
    removePid();
    return;
  }

  killProcessTree(pid, "SIGTERM");
  const gracefulExit = await waitForProcessExit(pid, GRACEFUL_EXIT_TIMEOUT_MS);
  if (gracefulExit) {
    console.log(`  HeySummon stopped (PID: ${pid})`);
    removePid();
    return;
  }

  console.warn(`  Process ${pid} did not exit on SIGTERM, sending SIGKILL`);
  killProcessTree(pid, "SIGKILL");
  const forcedExit = await waitForProcessExit(pid, FORCE_EXIT_TIMEOUT_MS);
  if (!forcedExit) {
    console.error(
      `  Failed to stop HeySummon (PID: ${pid}) after SIGKILL — leaving PID file in place`
    );
    process.exit(1);
  }

  console.log(`  HeySummon stopped (PID: ${pid}, forced)`);
  removePid();
}
