import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import * as p from "@clack/prompts";
import {
  getHeysummonDir,
  getAppDir,
  isInitialized,
  readPid,
  removePid,
  isProcessRunning,
} from "../lib/config";
import { askYesNo, askConfirmText } from "../lib/prompts";
import {
  color,
  printError,
  printInfo,
  printSuccess,
  printWarning,
} from "../lib/ui";

function stopServer(): void {
  // Try pm2 first
  try {
    execSync("pm2 describe heysummon", { stdio: "pipe" });
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
  p.intro(color.red("heysummon uninstall"));

  const heysummonDir = getHeysummonDir();

  if (!isInitialized()) {
    p.log.info("HeySummon does not appear to be installed.");
    p.log.info(`Nothing found at ${color.cyan(heysummonDir)}`);
    p.outro("Nothing to do.");
    return;
  }

  // Show exactly what will be deleted
  p.note(
    [
      `${color.red("✗")}  ${color.cyan(heysummonDir)}`,
      `   ${color.dim("├── app/        (Next.js server + build)")}`,
      `   ${color.dim("├── .env        (config & secrets)")}`,
      `   ${color.dim("└── app/prisma/heysummon.db  (all your data)")}`,
    ].join("\n"),
    "This will permanently delete"
  );

  p.log.warn("Your accounts, API keys, and request history will be lost.");

  // Offer database backup
  const wantsBackup = await askYesNo(
    "Back up your database before uninstalling?",
    true
  );

  if (wantsBackup) {
    backupDatabase(heysummonDir);
  }

  // Explicit confirmation — user must type "uninstall"
  const confirmed = await askConfirmText(
    `Type ${color.bold(color.red("uninstall"))} to confirm`,
    "uninstall"
  );

  if (!confirmed) {
    p.cancel("Cancelled — nothing was removed.");
    return;
  }

  // Step 1: Stop server
  stopServer();

  // Step 2: Delete ~/.heysummon/
  const rmSpinner = p.spinner();
  rmSpinner.start(`Removing ${heysummonDir}...`);

  try {
    const appDir = getAppDir();
    if (fs.existsSync(appDir)) {
      fs.rmSync(appDir, { recursive: true, force: true });
    }
    fs.rmSync(heysummonDir, { recursive: true, force: true });
    rmSpinner.stop("Application data removed");
  } catch (err) {
    rmSpinner.stop("Failed to remove application data.");
    if (err instanceof Error) {
      printError(err.message);
    }
    process.exit(1);
  }

  // Done
  p.log.info(
    `The ${color.cyan("heysummon")} CLI binary is still installed.`
  );
  p.log.info(
    `To remove it: ${color.cyan("npm uninstall -g heysummon")}`
  );

  p.outro("HeySummon has been uninstalled.");
}
