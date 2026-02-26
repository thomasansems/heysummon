import { spawn, execSync } from "child_process";
import * as path from "path";
import * as fs from "fs";
import {
  getAppDir,
  getEnvFile,
  isInitialized,
  writePid,
  readPid,
  isProcessRunning,
} from "../lib/config";
import { printSuccess, printInfo, printWarning, color } from "../lib/ui";

function copyEnvToApp(): void {
  const envFile = getEnvFile();
  const appEnv = path.join(getAppDir(), ".env");
  if (fs.existsSync(envFile)) {
    fs.copyFileSync(envFile, appEnv);
  }
}

function hasPm2(): boolean {
  try {
    execSync("pm2 --version", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function getServerScript(appDir: string): { cmd: string; args: string[] } {
  // Prefer standalone server (next build with output: standalone)
  const standaloneServer = path.join(appDir, ".next", "standalone", "server.js");
  if (fs.existsSync(standaloneServer)) {
    return { cmd: "node", args: [standaloneServer] };
  }
  // Fallback: npm start
  return { cmd: "npm", args: ["start"] };
}

export async function startDaemon(port?: number): Promise<void> {
  const appDir = getAppDir();
  copyEnvToApp();

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: "production",
    ...(port ? { PORT: String(port) } : {}),
  };

  if (hasPm2()) {
    const { cmd, args } = getServerScript(appDir);
    const startCmd = `pm2 start ${cmd} --name heysummon -- ${args.join(" ")}`;
    execSync(startCmd, { cwd: appDir, stdio: "pipe", env });
    printSuccess(`Started with pm2 ${color.dim("(heysummon)")}`);
    printInfo(`Logs:   ${color.cyan("pm2 logs heysummon")}`);
    printInfo(`Stop:   ${color.cyan("heysummon stop")}`);
  } else {
    // Fallback: detached process
    const { cmd, args } = getServerScript(appDir);
    const child = spawn(cmd, args, {
      cwd: appDir,
      stdio: "ignore",
      detached: true,
      env,
    });
    child.unref();
    writePid(child.pid!);
    printSuccess(`Started in background ${color.dim(`(PID: ${child.pid})`)}`);
    printWarning(`Install pm2 for better process management: ${color.cyan("npm install -g pm2")}`);
  }
}

export function startForeground(port?: number): void {
  const appDir = getAppDir();
  copyEnvToApp();

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: "production",
    ...(port ? { PORT: String(port) } : {}),
  };

  const { cmd, args } = getServerScript(appDir);
  printInfo(`Starting ${color.cyan(`${cmd} ${args.join(" ")}`)}`);
  printInfo("Press Ctrl+C to stop\n");

  const child = spawn(cmd, args, {
    cwd: appDir,
    stdio: "inherit",
    env,
  });

  writePid(child.pid!);
  child.on("close", (code) => process.exit(code ?? 0));
  process.on("SIGINT", () => child.kill("SIGINT"));
  process.on("SIGTERM", () => child.kill("SIGTERM"));
}

export async function start(args: string[]): Promise<void> {
  if (!isInitialized()) {
    console.log(`\n  HeySummon is not installed. Run ${color.cyan("npm install -g heysummon")} first.\n`);
    process.exit(1);
  }

  const existingPid = readPid();
  if (existingPid && isProcessRunning(existingPid)) {
    printInfo(`Already running (PID: ${existingPid})`);
    return;
  }

  const daemon = args.includes("--daemon") || args.includes("-d");

  if (daemon) {
    await startDaemon();
  } else {
    startForeground();
  }
}
