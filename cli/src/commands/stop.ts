import { execSync } from "child_process";
import { readPid, removePid, isProcessRunning } from "../lib/config";

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

  try {
    process.kill(pid, "SIGTERM");
    console.log(`  HeySummon stopped (PID: ${pid})`);
    removePid();
  } catch (err) {
    console.error(`  Failed to stop HeySummon (PID: ${pid}):`, err);
    process.exit(1);
  }
}
