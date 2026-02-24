import { execSync } from "child_process";
import { getAppDir, getEnvFile } from "./config";
import * as fs from "fs";
import * as path from "path";

function runInAppDir(command: string): void {
  const appDir = getAppDir();
  const envFile = getEnvFile();

  // Symlink .env into app dir if not already there
  const appEnv = path.join(appDir, ".env");
  if (!fs.existsSync(appEnv)) {
    fs.copyFileSync(envFile, appEnv);
  }

  execSync(command, {
    cwd: appDir,
    stdio: "inherit",
    env: { ...process.env, NODE_ENV: "production" },
  });
}

export function installDependencies(): void {
  console.log("\n  Installing dependencies...");
  runInAppDir("npm install --production");
}

export function runMigrations(): void {
  console.log("\n  Running database migrations...");
  runInAppDir("npx prisma migrate deploy");
}

export function buildApp(): void {
  console.log("\n  Building application...");
  runInAppDir("npm run build");
}
