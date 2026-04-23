import { spawn, execSync } from "child_process";
import * as path from "path";
import * as fs from "fs";
import {
  getAppDir,
  getEnvFile,
  getServerLogFile,
  isInitialized,
  writePid,
  readPid,
  isProcessRunning,
} from "../lib/config";
import { printSuccess, printInfo, printWarning, printError, color } from "../lib/ui";

const DAEMON_STARTUP_GRACE_MS = 2_000;
const DAEMON_LOG_TAIL_BYTES = 8_192;

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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readLogTail(logPath: string, maxBytes = DAEMON_LOG_TAIL_BYTES): string {
  try {
    const stat = fs.statSync(logPath);
    const start = Math.max(0, stat.size - maxBytes);
    const fd = fs.openSync(logPath, "r");
    try {
      const length = stat.size - start;
      const buf = Buffer.alloc(length);
      fs.readSync(fd, buf, 0, length, start);
      return buf.toString("utf-8");
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return "";
  }
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
    return;
  }

  // Fallback: detached process with stdout/stderr captured to a log file so
  // failures (EADDRINUSE, missing env, etc.) are diagnosable after the fact.
  const { cmd, args } = getServerScript(appDir);
  const logPath = getServerLogFile();
  const logFd = fs.openSync(logPath, "a");
  try {
    fs.writeSync(
      logFd,
      `\n--- ${new Date().toISOString()} starting ${cmd} ${args.join(" ")} ---\n`
    );
  } catch {
    // non-fatal
  }

  const child = spawn(cmd, args, {
    cwd: appDir,
    stdio: ["ignore", logFd, logFd],
    detached: true,
    env,
  });
  child.unref();
  // The parent no longer needs the fd once it is inherited by the child.
  try {
    fs.closeSync(logFd);
  } catch {
    // ignore
  }

  const pid = child.pid;
  if (!pid) {
    printError("Failed to spawn HeySummon daemon");
    const tail = readLogTail(logPath);
    if (tail) console.error(tail);
    process.exit(1);
  }

  writePid(pid);

  // Give the daemon a moment to either bind the port or crash. If it exits
  // during this window, the error is almost always visible in the log — so
  // surface it here rather than letting downstream health probes time out.
  await sleep(DAEMON_STARTUP_GRACE_MS);

  if (!isProcessRunning(pid)) {
    printError(`HeySummon daemon exited during startup (PID: ${pid})`);
    printInfo(`Log: ${color.cyan(logPath)}`);
    const tail = readLogTail(logPath);
    if (tail) {
      console.error("\n--- server.log tail ---");
      console.error(tail);
      console.error("--- end log ---\n");
    }
    process.exit(1);
  }

  printSuccess(`Started in background ${color.dim(`(PID: ${pid})`)}`);
  printInfo(`Log:    ${color.cyan(logPath)}`);
  printWarning(`Install pm2 for better process management: ${color.cyan("npm install -g pm2")}`);
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
