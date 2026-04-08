import { execSync } from "child_process";
import { getAppDir, getEnvFile } from "./config";
import * as fs from "fs";
import * as path from "path";

function runInAppDir(command: string, opts: { silent?: boolean; production?: boolean } = {}): void {
  const { silent = true, production = true } = opts;
  const appDir = getAppDir();
  const envFile = getEnvFile();

  const appEnv = path.join(appDir, ".env");
  if (!fs.existsSync(appEnv)) {
    fs.copyFileSync(envFile, appEnv);
  }

  const env = { ...process.env };
  if (production) {
    env.NODE_ENV = "production";
  }

  execSync(command, {
    cwd: appDir,
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

export function buildApp(): void {
  // Suppress noisy next build output — only show errors
  try {
    runInAppDir("npm run build");
  } catch (err) {
    // Re-run with output on failure so user sees what went wrong
    runInAppDir("npm run build", { silent: false });
    throw err;
  }
}
