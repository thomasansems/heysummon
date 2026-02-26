import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import {
  getHeysummonDir,
  getAppDir,
  isInitialized,
  readPid,
  removePid,
  isProcessRunning,
} from "../lib/config";
import { ask, askYesNo } from "../lib/prompts";
import {
  color,
  printDivider,
  printError,
  printInfo,
  printSuccess,
  printWarning,
} from "../lib/ui";

function stopServer(): void {
  // Try pm2 first
  try {
    execSync("pm2 describe heysummon", { stdio: "pipe" });
    console.log("");
    printInfo("Stopping HeySummon (pm2)...");
    execSync("pm2 stop heysummon", { stdio: "pipe" });
    execSync("pm2 delete heysummon", { stdio: "pipe" });
    printSuccess("Server stopped");
    return;
  } catch {
    // Not managed by pm2
  }

  // Fall back to PID file
  const pid = readPid();
  if (!pid) return;

  if (isProcessRunning(pid)) {
    printInfo(`Stopping HeySummon (PID: ${pid})...`);
    try {
      process.kill(pid, "SIGTERM");
      removePid();
      printSuccess("Server stopped");
    } catch {
      printWarning(`Could not stop process ${pid} — you may need to stop it manually.`);
    }
  } else {
    removePid();
  }
}

function backupDatabase(heysummonDir: string): void {
  const dbSource = path.join(heysummonDir, "app", "prisma", "heysummon.db");

  if (!fs.existsSync(dbSource)) {
    printWarning("No database found to back up.");
    return;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const backupPath = path.join(
    process.env.HOME || "~",
    `heysummon-backup-${timestamp}.db`
  );

  fs.copyFileSync(dbSource, backupPath);
  printSuccess(`Database backed up to: ${color.cyan(backupPath)}`);
}

export async function uninstall(): Promise<void> {
  console.log("");
  console.log(`  ${color.bold(color.red("⚠  Uninstall HeySummon"))}`);
  printDivider();
  console.log("");

  const heysummonDir = getHeysummonDir();
  const appDir = getAppDir();

  if (!isInitialized()) {
    printInfo("HeySummon does not appear to be installed.");
    printInfo(`Nothing found at ${color.cyan(heysummonDir)}`);
    console.log("");
    return;
  }

  // Show exactly what will be deleted
  console.log(`  ${color.bold("This will permanently delete:")}`);
  console.log("");
  console.log(`    ${color.red("✗")}  ${color.cyan(heysummonDir)}`);
  console.log(`       ${color.dim("├── app/        (Next.js server + build)")}`);
  console.log(`       ${color.dim("├── .env        (config & secrets)")}`);
  console.log(`       ${color.dim("└── app/prisma/heysummon.db  (all your data)")}`);
  console.log("");
  printWarning("Your accounts, API keys, and request history will be lost.");
  console.log("");

  // Offer database backup
  const wantsBackup = await askYesNo(
    "Do you want to back up your database before uninstalling?",
    true
  );

  if (wantsBackup) {
    backupDatabase(heysummonDir);
    console.log("");
  }

  // Explicit confirmation — user must type "uninstall"
  printDivider();
  console.log("");
  console.log(
    `  To confirm, type ${color.bold(color.red("uninstall"))} and press Enter.`
  );
  console.log(`  ${color.dim("(anything else will cancel)")}`);
  console.log("");

  const confirmation = await ask("  Confirm");

  if (confirmation !== "uninstall") {
    console.log("");
    printInfo("Cancelled — nothing was removed.");
    console.log("");
    return;
  }

  console.log("");

  // Step 1: Stop server
  stopServer();

  // Step 2: Delete ~/.heysummon/
  printInfo(`Removing ${color.cyan(heysummonDir)}...`);
  try {
    if (fs.existsSync(appDir)) {
      fs.rmSync(appDir, { recursive: true, force: true });
    }
    fs.rmSync(heysummonDir, { recursive: true, force: true });
    printSuccess("Application data removed");
  } catch (err) {
    printError("Failed to remove application data.");
    if (err instanceof Error) {
      console.error(`  ${color.dim(err.message)}`);
    }
    process.exit(1);
  }

  // Done
  console.log("");
  printDivider();
  console.log("");
  printSuccess("HeySummon has been uninstalled.");
  console.log("");
  printInfo(
    `The ${color.cyan("heysummon")} CLI binary is still installed on your system.`
  );
  printInfo("To remove it as well, run:");
  console.log("");
  console.log(`    ${color.cyan("npm uninstall -g heysummon")}`);
  console.log("");
}
