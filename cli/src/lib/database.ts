import { execSync } from "child_process";
import { getAppDir, getEnvFile } from "./config";
import * as fs from "fs";
import * as path from "path";

function runInAppDir(command: string, silent = true): void {
  const appDir = getAppDir();
  const envFile = getEnvFile();

  const appEnv = path.join(appDir, ".env");
  if (!fs.existsSync(appEnv)) {
    fs.copyFileSync(envFile, appEnv);
  }

  execSync(command, {
    cwd: appDir,
    stdio: silent ? "pipe" : "inherit",
    env: { ...process.env, NODE_ENV: "production" },
  });
}

export function installDependencies(): void {
  runInAppDir("npm install --production --silent 2>/dev/null || npm install --production");
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
    runInAppDir("npm run build", false);
    throw err;
  }
}
