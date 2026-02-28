import * as fs from "fs";
import {
  getHeysummonDir,
  getAppDir,
  isInitialized,
  ensureDir,
  generateEnv,
  writeEnv,
  HeysummonConfig,
} from "../lib/config";
import { generateSecrets } from "../lib/secrets";
import { downloadAndExtract } from "../lib/download";
import { installDependencies, runMigrations, buildApp } from "../lib/database";
import { ask, askYesNo } from "../lib/prompts";
import { startDaemon } from "./start";
import {
  printBanner,
  printStep,
  printSuccess,
  printInfo,
  printDivider,
  printWarning,
  color,
} from "../lib/ui";

const TOTAL_STEPS = 5;

export async function init(): Promise<void> {
  printBanner();

  if (isInitialized()) {
    const reinit = await askYesNo(
      `HeySummon is already installed. Reinstall from scratch?`,
      false
    );
    if (!reinit) {
      console.log(`\n  ${color.dim("Tip: use")} ${color.cyan("heysummon start")} ${color.dim("to run the server.")}`);
      return;
    }
    const appDir = getAppDir();
    if (fs.existsSync(appDir)) {
      fs.rmSync(appDir, { recursive: true });
    }
  }

  // Create directory structure
  ensureDir(getHeysummonDir());
  ensureDir(getAppDir());

  // ── Step 1: Download ──────────────────────────────────────────────
  printStep(1, TOTAL_STEPS, "Download");
  printInfo("Fetching the latest release from GitHub...");
  const version = await downloadAndExtract();
  printSuccess(`Downloaded HeySummon ${version}`);

  // ── Step 2: Configuration ─────────────────────────────────────────
  printStep(2, TOTAL_STEPS, "Configuration");
  console.log(`  ${color.dim("Configure how HeySummon runs on your machine.")}`);
  console.log("");

  const port = parseInt(await ask("  Guard port (app entry point)", "3435"), 10) || 3435;
  const mercurePort = parseInt(await ask("  Mercure port (realtime hub)", "3436"), 10) || 3436;

  console.log("");
  printInfo(`HeySummon will be available at: ${color.cyan(`http://localhost:${port}`)}`);
  printInfo("If you want it reachable from the internet, set your public URL below.");
  const publicUrl = await ask("  Public URL", `http://localhost:${port}`);

  printSuccess("Configuration saved");

  // ── Step 3: Secrets ───────────────────────────────────────────────
  printStep(3, TOTAL_STEPS, "Generate secrets");
  printInfo("Creating secure random secrets for auth and encryption...");
  const secrets = generateSecrets();

  const config: HeysummonConfig = {
    port,
    mercurePort,
    publicUrl,
    enableFormLogin: true,
    enableGithubOauth: false,
    enableGoogleOauth: false,
  };

  const envContent = generateEnv(config, secrets);
  writeEnv(envContent);
  printSuccess("Secrets generated and saved");

  // ── Step 4: Database ──────────────────────────────────────────────
  printStep(4, TOTAL_STEPS, "Database setup");
  printInfo("Setting up SQLite database and running migrations...");
  installDependencies();
  runMigrations();
  printSuccess("Database ready");

  // ── Step 5: Build ─────────────────────────────────────────────────
  printStep(5, TOTAL_STEPS, "Build");
  printInfo("Building the application (this takes ~30 seconds)...");
  buildApp();
  printSuccess("Build complete");

  // ── Done ──────────────────────────────────────────────────────────
  console.log("");
  printDivider();
  console.log("");
  console.log(`  ${color.boldGreen("✓ HeySummon is ready!")}`);
  console.log("");
  printInfo(`Dashboard: ${color.cyan(publicUrl)}`);
  printInfo(`Docs:      ${color.cyan("https://docs.heysummon.ai/getting-started/quickstart")}`);
  console.log("");
  printInfo("Starting HeySummon in the background...");
  console.log("");

  try {
    await startDaemon(port);
    console.log("");
    printSuccess("HeySummon is running!");
    console.log("");
    printInfo(`Open ${color.cyan(publicUrl)} to create your account.`);
    printInfo(`Run ${color.cyan("heysummon status")} to check the server.`);
    printInfo(`Run ${color.cyan("heysummon stop")} to stop the server.`);
  } catch {
    printWarning("Could not start automatically. Run: " + color.cyan("heysummon start -d"));
  }

  console.log("");
}
