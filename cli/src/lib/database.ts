import { spawn } from "child_process";
import { getAppDir, getEnvFile } from "./config";
import * as fs from "fs";
import * as path from "path";

function runInAppDir(command: string, silent = true): Promise<void> {
  const appDir = getAppDir();
  const envFile = getEnvFile();

  const appEnv = path.join(appDir, ".env");
  if (!fs.existsSync(appEnv)) {
    fs.copyFileSync(envFile, appEnv);
  }

  return new Promise((resolve, reject) => {
    const child = spawn("sh", ["-c", command], {
      cwd: appDir,
      stdio: silent ? "pipe" : "inherit",
      env: { ...process.env, NODE_ENV: "production" },
    });

    let stderr = "";
    if (silent && child.stderr) {
      child.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
      });
    }

    child.on("error", (err) => {
      reject(err);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        const msg = stderr.trim()
          ? `Command failed (exit ${code}): ${stderr.trim()}`
          : `Command failed with exit code ${code}`;
        reject(new Error(msg));
      }
    });
  });
}

export async function installDependencies(): Promise<void> {
  await runInAppDir(
    "npm install --production --silent 2>/dev/null || npm install --production"
  );
}

export async function runMigrations(): Promise<void> {
  await runInAppDir("npx prisma migrate deploy");
}

export async function buildApp(): Promise<void> {
  try {
    await runInAppDir("npm run build");
  } catch (err) {
    await runInAppDir("npm run build", false);
    throw err;
  }
}
