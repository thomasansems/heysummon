import * as http from "http";
import * as fs from "fs";
import * as path from "path";
import { readPid, isProcessRunning, isInitialized, getAppDir, getEnvFile } from "../lib/config";
import { color, printDivider } from "../lib/ui";

function checkHealth(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(
      `http://localhost:${port}/api/health`,
      { timeout: 3000 },
      (res) => resolve(res.statusCode === 200)
    );
    req.on("error", () => resolve(false));
    req.on("timeout", () => { req.destroy(); resolve(false); });
  });
}

function readPort(): number | null {
  try {
    const envFile = path.join(getAppDir(), ".env");
    const fallback = getEnvFile();
    const file = fs.existsSync(envFile) ? envFile : fallback;
    const content = fs.readFileSync(file, "utf8");
    const match = content.match(/^PORT=(\d+)/m);
    return match ? parseInt(match[1], 10) : null;
  } catch {
    return null;
  }
}

export async function status(): Promise<void> {
  console.log("");

  if (!isInitialized()) {
    console.log(`  ${color.yellow("○")} Not installed`);
    console.log(`  ${color.dim("Run")} ${color.cyan("npx heysummon")} ${color.dim("to get started.")}`);
    console.log("");
    return;
  }

  const pid = readPid();
  const running = pid !== null && isProcessRunning(pid);
  const port = readPort() || 3435;

  printDivider();
  console.log(`  ${color.bold("HeySummon Status")}`);
  printDivider();
  console.log("");

  if (running) {
    const healthy = await checkHealth(port);
    console.log(`  ${color.green("●")} ${color.bold("Running")} ${color.dim(`(PID: ${pid})`)}`);
    console.log(`  ${color.dim("Health:")}  ${healthy ? color.green("ok") : color.yellow("unreachable")}`);
    console.log(`  ${color.dim("URL:")}     ${color.cyan(`http://localhost:${port}`)}`);
    console.log(`  ${color.dim("Logs:")}    ${color.cyan("pm2 logs heysummon")}`);
  } else {
    console.log(`  ${color.dim("○")} ${color.bold("Stopped")}`);
    console.log(`  ${color.dim("Run")} ${color.cyan("heysummon start -d")} ${color.dim("to start.")}`);
  }

  console.log("");
  printDivider();
  console.log("");
}
