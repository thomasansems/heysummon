import { spawn, execSync } from "child_process";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import {
  getAppDir,
  getEnvFile,
  isInitialized,
  writePid,
  readPid,
  isProcessRunning,
} from "../lib/config";
import { printSuccess, printInfo, printWarning, color } from "../lib/ui";

const MERCURE_PID_FILE = path.join(os.homedir(), ".heysummon", "mercure.pid");

function readMercurePid(): number | null {
  try {
    const pid = parseInt(fs.readFileSync(MERCURE_PID_FILE, "utf-8").trim(), 10);
    return isNaN(pid) ? null : pid;
  } catch { return null; }
}

function findMercureBinary(): string | null {
  const candidates = [
    path.join(os.homedir(), "bin", "mercure"),
    "/usr/local/bin/mercure",
    "/usr/bin/mercure",
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  try { execSync("which mercure", { stdio: "pipe" }); return "mercure"; } catch { return null; }
}

function startMercure(appDir: string, env: NodeJS.ProcessEnv): void {
  const binary = findMercureBinary();
  if (!binary) {
    printWarning("Mercure binary not found — realtime features disabled. See docs for install instructions.");
    return;
  }

  const mercurePort = env.MERCURE_PORT || "3436";
  const caddyfile = path.join(appDir, "mercure.Caddyfile");

  // Write a minimal Caddyfile for Mercure
  fs.writeFileSync(caddyfile, `{
    auto_https off
}

:${mercurePort} {
    route {
        mercure {
            publisher_jwt {env.MERCURE_JWT_SECRET}
            subscriber_jwt {env.MERCURE_JWT_SECRET}
            subscriptions
            cors_origins *
        }
        respond /healthz 200
    }
}
`);

  const child = spawn(binary, ["run", "--config", caddyfile], {
    cwd: appDir,
    stdio: "ignore",
    detached: true,
    env,
  });
  child.unref();
  fs.writeFileSync(MERCURE_PID_FILE, String(child.pid!), "utf-8");
  printSuccess(`Mercure hub started ${color.dim(`(PID: ${child.pid}, port: ${mercurePort})`)}`);
}

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

  startMercure(appDir, env);

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

  startMercure(appDir, env);

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
