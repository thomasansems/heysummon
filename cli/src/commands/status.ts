import * as http from "http";
import { readPid, isProcessRunning, isInitialized } from "../lib/config";

function checkHealth(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(
      `http://localhost:${port}/api/health`,
      { timeout: 5000 },
      (res) => {
        resolve(res.statusCode === 200);
      }
    );
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
}

export async function status(): Promise<void> {
  if (!isInitialized()) {
    console.log("  HeySummon is not initialized. Run 'heysummon init' first.");
    return;
  }

  const pid = readPid();
  const running = pid !== null && isProcessRunning(pid);

  console.log("");
  console.log(`  HeySummon Status`);
  console.log(`  ================`);
  console.log(`  Initialized: yes`);
  console.log(`  Process:     ${running ? `running (PID: ${pid})` : "stopped"}`);

  if (running) {
    // Try common ports
    for (const port of [3000, 3001, 8080]) {
      const healthy = await checkHealth(port);
      if (healthy) {
        console.log(`  Health:      ok (port ${port})`);
        console.log(`  URL:         http://localhost:${port}`);
        console.log("");
        return;
      }
    }
    console.log(`  Health:      unreachable`);
  }

  console.log("");
}
