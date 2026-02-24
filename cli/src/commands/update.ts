import {
  isInitialized,
  readPid,
  isProcessRunning,
} from "../lib/config";
import { downloadAndExtract } from "../lib/download";
import { installDependencies, runMigrations, buildApp } from "../lib/database";
import { stop } from "./stop";
import { startForeground } from "./start";

export async function update(): Promise<void> {
  if (!isInitialized()) {
    console.log("  HeySummon is not initialized. Run 'heysummon init' first.");
    process.exit(1);
  }

  const wasRunning = (() => {
    const pid = readPid();
    return pid !== null && isProcessRunning(pid);
  })();

  if (wasRunning) {
    console.log("\n  Stopping HeySummon...");
    await stop();
  }

  console.log("\n  Downloading latest release...");
  const version = await downloadAndExtract();
  console.log(`  Downloaded ${version}`);

  installDependencies();
  runMigrations();
  buildApp();

  console.log(`\n  Updated to ${version}`);

  if (wasRunning) {
    console.log("  Restarting...\n");
    startForeground();
  }
}
