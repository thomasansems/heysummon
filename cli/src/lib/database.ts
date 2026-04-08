import { execSync, spawn as nodeSpawn } from "child_process";
import { getAppDir, getEnvFile } from "./config";
import * as fs from "fs";
import * as path from "path";

function ensureAppEnv(): void {
  const appDir = getAppDir();
  const envFile = getEnvFile();
  const appEnv = path.join(appDir, ".env");
  if (!fs.existsSync(appEnv)) {
    fs.copyFileSync(envFile, appEnv);
  }
}

function runInAppDir(command: string, opts: { silent?: boolean; production?: boolean } = {}): void {
  const { silent = true, production = true } = opts;
  ensureAppEnv();

  const env = { ...process.env };
  if (production) {
    env.NODE_ENV = "production";
  }

  execSync(command, {
    cwd: getAppDir(),
    stdio: silent ? "pipe" : "inherit",
    env,
  });
}

export function installDependencies(): void {
  runInAppDir("npm install --legacy-peer-deps --silent 2>/dev/null || npm install --legacy-peer-deps", { production: false });
}

export function runMigrations(): void {
  runInAppDir("npx prisma migrate deploy");
}

/**
 * Build with progress callback. Calls onProgress with elapsed seconds
 * so the caller can update a spinner message.
 */
export function buildApp(onProgress?: (elapsedSec: number) => void): Promise<void> {
  ensureAppEnv();

  const env = { ...process.env, NODE_ENV: "production" };

  return new Promise((resolve, reject) => {
    const child = nodeSpawn("npm", ["run", "build"], {
      cwd: getAppDir(),
      stdio: "pipe",
      env,
      shell: true,
    });

    let stderr = "";
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    const startTime = Date.now();
    const timer = onProgress
      ? setInterval(() => {
          const elapsed = Math.round((Date.now() - startTime) / 1000);
          onProgress(elapsed);
        }, 5000)
      : null;

    child.on("close", (code) => {
      if (timer) clearInterval(timer);
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Build failed (exit ${code}):\n${stderr.slice(-2000)}`));
      }
    });

    child.on("error", (err) => {
      if (timer) clearInterval(timer);
      reject(err);
    });
  });
}

/**
 * Wait for the app to respond on the health endpoint.
 * Returns true if healthy within the timeout, false otherwise.
 */
export async function waitForHealthy(port: number, timeoutSec: number = 30): Promise<boolean> {
  const url = `http://localhost:${port}/api/v1/health`;
  const deadline = Date.now() + timeoutSec * 1000;

  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (res.ok) return true;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return false;
}
