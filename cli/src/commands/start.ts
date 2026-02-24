import { spawn, execSync } from "child_process";
import * as path from "path";
import {
  getAppDir,
  getEnvFile,
  isInitialized,
  writePid,
  readPid,
  isProcessRunning,
} from "../lib/config";
import * as fs from "fs";

function copyEnvToApp(): void {
  const envFile = getEnvFile();
  const appEnv = path.join(getAppDir(), ".env");
  if (fs.existsSync(envFile)) {
    fs.copyFileSync(envFile, appEnv);
  }
}

export function startForeground(port?: number): void {
  const appDir = getAppDir();
  copyEnvToApp();

  const env: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: "production" };
  if (port) {
    env.PORT = String(port);
  }

  const child = spawn("npm", ["start"], {
    cwd: appDir,
    stdio: "inherit",
    env,
  });

  writePid(child.pid!);

  child.on("close", (code) => {
    process.exit(code ?? 0);
  });

  process.on("SIGINT", () => {
    child.kill("SIGINT");
  });
  process.on("SIGTERM", () => {
    child.kill("SIGTERM");
  });
}

function hasPm2(): boolean {
  try {
    execSync("pm2 --version", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function startDaemon(): void {
  const appDir = getAppDir();
  copyEnvToApp();

  if (hasPm2()) {
    console.log("  Starting with pm2...");
    execSync(`pm2 start npm --name heysummon -- start`, {
      cwd: appDir,
      stdio: "inherit",
      env: { ...process.env, NODE_ENV: "production" },
    });
    console.log("  HeySummon started in background (pm2)");
    console.log("  Use 'pm2 logs heysummon' to view logs");
  } else {
    console.log("  Starting in background...");
    const child = spawn("npm", ["start"], {
      cwd: appDir,
      stdio: "ignore",
      detached: true,
      env: { ...process.env, NODE_ENV: "production" },
    });

    child.unref();
    writePid(child.pid!);
    console.log(`  HeySummon started (PID: ${child.pid})`);
  }
}

export async function start(args: string[]): Promise<void> {
  if (!isInitialized()) {
    console.log("  HeySummon is not initialized. Run 'heysummon init' first.");
    process.exit(1);
  }

  const existingPid = readPid();
  if (existingPid && isProcessRunning(existingPid)) {
    console.log(`  HeySummon is already running (PID: ${existingPid})`);
    return;
  }

  const daemon = args.includes("--daemon") || args.includes("-d");

  if (daemon) {
    startDaemon();
  } else {
    console.log("  Starting HeySummon...");
    console.log("  Press Ctrl+C to stop\n");
    startForeground();
  }
}
