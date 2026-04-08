import * as os from "os";
import { execSync } from "child_process";

export interface SystemInfo {
  ramMb: number;
  cpuCores: number;
  diskFreeMb: number;
  diskTotalMb: number;
  platform: string;
  arch: string;
}

export interface SystemCheckResult {
  info: SystemInfo;
  canInstall: boolean;
  warnings: string[];
  estimatedMinutes: { min: number; max: number };
}

const MIN_DISK_MB = 1500; // ~1.5 GB needed for install + build artifacts
const MIN_RAM_MB = 512;
const RECOMMENDED_RAM_MB = 1024;

function getDiskSpace(dir: string): { freeMb: number; totalMb: number } {
  try {
    const output = execSync(`df -m "${dir}" 2>/dev/null | tail -1`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    const parts = output.split(/\s+/);
    // df -m output: Filesystem 1M-blocks Used Available Use% Mounted
    const totalMb = parseInt(parts[1], 10) || 0;
    const freeMb = parseInt(parts[3], 10) || 0;
    return { freeMb, totalMb };
  } catch {
    return { freeMb: 0, totalMb: 0 };
  }
}

export function getSystemInfo(installDir: string): SystemInfo {
  const ramMb = Math.round(os.totalmem() / (1024 * 1024));
  const cpuCores = os.cpus().length;
  const { freeMb, totalMb } = getDiskSpace(installDir);

  return {
    ramMb,
    cpuCores,
    diskFreeMb: freeMb,
    diskTotalMb: totalMb,
    platform: os.platform(),
    arch: os.arch(),
  };
}

function estimateBuildMinutes(info: SystemInfo): { min: number; max: number } {
  // Base estimate: Next.js production build
  // Fast machine (4+ cores, 4GB+ RAM): ~2-3 min
  // Medium machine (2 cores, 2GB RAM): ~4-6 min
  // Small machine (1-2 cores, 1GB RAM): ~7-12 min
  // Tiny machine (1 core, 512MB RAM): ~10-20 min

  let factor = 1;

  if (info.ramMb < 1024) factor *= 2.5;
  else if (info.ramMb < 2048) factor *= 1.5;
  else if (info.ramMb < 4096) factor *= 1.2;

  if (info.cpuCores <= 1) factor *= 2;
  else if (info.cpuCores <= 2) factor *= 1.3;

  const min = Math.max(2, Math.round(2 * factor));
  const max = Math.max(min + 1, Math.round(4 * factor));

  return { min, max };
}

export function checkSystem(installDir: string): SystemCheckResult {
  const info = getSystemInfo(installDir);
  const warnings: string[] = [];
  let canInstall = true;

  // Disk space check
  if (info.diskFreeMb > 0 && info.diskFreeMb < MIN_DISK_MB) {
    canInstall = false;
    warnings.push(
      `Not enough disk space: ${info.diskFreeMb} MB free, need at least ${MIN_DISK_MB} MB. ` +
      `Free up space or use a larger volume.`
    );
  } else if (info.diskFreeMb > 0 && info.diskFreeMb < MIN_DISK_MB * 2) {
    warnings.push(
      `Low disk space: ${info.diskFreeMb} MB free. HeySummon needs ~1.5 GB. ` +
      `Consider freeing up space to avoid issues.`
    );
  }

  // RAM check
  if (info.ramMb < MIN_RAM_MB) {
    canInstall = false;
    warnings.push(
      `Not enough memory: ${info.ramMb} MB RAM. HeySummon needs at least 512 MB. ` +
      `Use a larger instance (t2.small or bigger).`
    );
  } else if (info.ramMb < RECOMMENDED_RAM_MB) {
    warnings.push(
      `Low memory: ${info.ramMb} MB RAM. The build may be slow or run out of memory. ` +
      `Recommended: 1 GB+ RAM (t2.small or bigger).`
    );
  }

  // Swap check on low-RAM systems
  if (info.ramMb < 2048) {
    try {
      const swapOutput = execSync("free -m 2>/dev/null | grep Swap", {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      }).trim();
      const swapTotal = parseInt(swapOutput.split(/\s+/)[1], 10) || 0;
      if (swapTotal < 512) {
        warnings.push(
          `No swap space configured. With ${info.ramMb} MB RAM, the build may fail. ` +
          `Consider adding swap: sudo fallocate -l 2G /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile`
        );
      }
    } catch {
      // non-Linux or unable to check
    }
  }

  const estimatedMinutes = estimateBuildMinutes(info);

  return { info, canInstall, warnings, estimatedMinutes };
}

export function formatSystemSummary(result: SystemCheckResult): string {
  const { info, estimatedMinutes } = result;
  const lines: string[] = [];

  lines.push(`CPU:    ${info.cpuCores} core${info.cpuCores !== 1 ? "s" : ""}`);
  lines.push(`RAM:    ${info.ramMb} MB`);

  if (info.diskFreeMb > 0) {
    lines.push(`Disk:   ${info.diskFreeMb} MB free / ${info.diskTotalMb} MB total`);
  }

  lines.push(`Est:    ~${estimatedMinutes.min}–${estimatedMinutes.max} minutes to install`);

  return lines.join("\n");
}
