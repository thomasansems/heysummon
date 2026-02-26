import { defineConfig } from "@playwright/test";
import path from "path";
import os from "os";

const outputDir = path.join(os.tmpdir(), "playwright-heysummon");

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: process.env.BASE_URL || "http://thomas-pc.tail38a1e7.ts.net:3456",
    trace: "on-first-retry",
    video: "on",
    screenshot: "on",
  },
  globalTimeout: process.env.CI ? 5 * 60 * 1000 : undefined, // 5 min max in CI
  timeout: 30000, // 30s per test
  webServer: process.env.CI
    ? undefined // server started manually in CI workflow
    : undefined,
});
