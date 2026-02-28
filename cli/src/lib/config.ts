import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const HEYSUMMON_DIR = path.join(os.homedir(), ".heysummon");
const APP_DIR = path.join(HEYSUMMON_DIR, "app");
const ENV_FILE = path.join(HEYSUMMON_DIR, ".env");
const PID_FILE = path.join(HEYSUMMON_DIR, "heysummon.pid");

export function getHeysummonDir(): string {
  return HEYSUMMON_DIR;
}

export function getAppDir(): string {
  return APP_DIR;
}

export function getEnvFile(): string {
  return ENV_FILE;
}

export function getPidFile(): string {
  return PID_FILE;
}

export function isInitialized(): boolean {
  return fs.existsSync(HEYSUMMON_DIR) && fs.existsSync(APP_DIR);
}

export function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

export interface HeysummonConfig {
  port: number;
  mercurePort: number;
  publicUrl: string;
  enableFormLogin: boolean;
  enableGithubOauth: boolean;
  githubId?: string;
  githubSecret?: string;
  enableGoogleOauth: boolean;
  googleId?: string;
  googleSecret?: string;
}

export function generateEnv(
  config: HeysummonConfig,
  secrets: { nextauthSecret: string; mercureJwtSecret: string }
): string {
  const lines: string[] = [
    "# HeySummon Configuration",
    `# Generated on ${new Date().toISOString()}`,
    "",
    `DATABASE_URL="file:./prisma/heysummon.db"`,
    "",
    "# Server",
    `PORT=${config.port}`,
    `MERCURE_PORT=${config.mercurePort}`,
    `MERCURE_HUB_URL="http://localhost:${config.mercurePort}/.well-known/mercure"`,
    `NEXTAUTH_URL="${config.publicUrl}"`,
    `NEXTAUTH_SECRET="${secrets.nextauthSecret}"`,
    `MERCURE_JWT_SECRET="${secrets.mercureJwtSecret}"`,
    "",
    "# Authentication",
    `ENABLE_FORM_LOGIN="${config.enableFormLogin ? "true" : "false"}"`,
  ];

  if (config.enableGithubOauth && config.githubId && config.githubSecret) {
    lines.push("");
    lines.push("# GitHub OAuth");
    lines.push(`GITHUB_ID="${config.githubId}"`);
    lines.push(`GITHUB_SECRET="${config.githubSecret}"`);
  }

  if (config.enableGoogleOauth && config.googleId && config.googleSecret) {
    lines.push("");
    lines.push("# Google OAuth");
    lines.push(`GOOGLE_ID="${config.googleId}"`);
    lines.push(`GOOGLE_SECRET="${config.googleSecret}"`);
  }

  lines.push("");
  return lines.join("\n");
}

export function writeEnv(content: string): void {
  fs.writeFileSync(ENV_FILE, content, "utf-8");
}

export function readPid(): number | null {
  try {
    const pid = parseInt(fs.readFileSync(PID_FILE, "utf-8").trim(), 10);
    return isNaN(pid) ? null : pid;
  } catch {
    return null;
  }
}

export function writePid(pid: number): void {
  fs.writeFileSync(PID_FILE, String(pid), "utf-8");
}

export function removePid(): void {
  try {
    fs.unlinkSync(PID_FILE);
  } catch {
    // ignore if file doesn't exist
  }
}

export function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
