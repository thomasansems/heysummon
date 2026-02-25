import { defineConfig } from "@playwright/test";
import path from "path";
import os from "os";

const outputDir = path.join(os.tmpdir(), "playwright-heysummon");

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: process.env.BASE_URL || "http://thomas-pc.tail38a1e7.ts.net:3456",
    trace: "on-first-retry",
    video: "on",
    screenshot: "on",
  },
  webServer: process.env.CI
    ? {
        command: "npx next start -p 3456",
        url: "http://localhost:3456",
        reuseExistingServer: true,
        timeout: 5000,
      }
    : undefined,
});
