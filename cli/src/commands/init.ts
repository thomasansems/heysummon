import * as fs from "fs";
import * as p from "@clack/prompts";
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
import { askYesNo } from "../lib/prompts";
import { startDaemon } from "./start";
import { printAnimatedBanner, color } from "../lib/ui";

export async function init(opts?: { yes?: boolean }): Promise<void> {
  const quickstart = opts?.yes ?? false;

  await printAnimatedBanner();

  p.intro("heysummon init");

  const heysummonDir = getHeysummonDir();

  p.log.info(`Home: ${color.cyan(heysummonDir)}`);

  // Check existing installation
  if (isInitialized()) {
    if (quickstart) {
      p.log.warn("Existing installation found — reinstalling.");
    } else {
      const reinit = await askYesNo(
        "HeySummon is already installed. Reinstall from scratch?",
        false
      );
      if (!reinit) {
        p.outro(
          `Tip: use ${color.cyan("heysummon start")} to run the server.`
        );
        return;
      }
    }
    const appDir = getAppDir();
    if (fs.existsSync(appDir)) {
      fs.rmSync(appDir, { recursive: true });
    }
  }

  // Create directory structure
  ensureDir(getHeysummonDir());
  ensureDir(getAppDir());

  // ── Step 1: Download ─────────────────────────────────────────────────
  const dlSpinner = p.spinner();
  dlSpinner.start("[Step 1/6] Downloading latest release from GitHub...");
  const version = await downloadAndExtract();
  dlSpinner.stop(`[Step 1/6] Downloaded HeySummon ${version}`);

  // ── Configuration ───────────────────────────────────────────────────
  let port = 3435;
  let publicUrl = `http://localhost:${port}`;

  if (!quickstart) {
    const portInput = await p.text({
      message: "App port",
      defaultValue: "3435",
      placeholder: "3435",
    });
    if (p.isCancel(portInput)) {
      p.cancel("Setup cancelled.");
      process.exit(0);
    }
    port = parseInt(String(portInput), 10) || 3435;

    p.log.info(
      `HeySummon will be available at: ${color.cyan(`http://localhost:${port}`)}`
    );

    const urlInput = await p.text({
      message: "Public URL (for internet access, or keep default)",
      defaultValue: `http://localhost:${port}`,
      placeholder: `http://localhost:${port}`,
    });
    if (p.isCancel(urlInput)) {
      p.cancel("Setup cancelled.");
      process.exit(0);
    }
    publicUrl = String(urlInput);
  } else {
    p.log.info(
      `Using defaults: port ${color.cyan("3435")}, URL ${color.cyan(publicUrl)}`
    );
  }

  // ── Step 2: Secrets ──────────────────────────────────────────────────
  const secretsSpinner = p.spinner();
  secretsSpinner.start("[Step 2/6] Generating secure random secrets...");
  const secrets = generateSecrets();

  const config: HeysummonConfig = {
    port,
    publicUrl,
    enableFormLogin: true,
    enableGithubOauth: false,
    enableGoogleOauth: false,
  };

  const envContent = generateEnv(config, secrets);
  writeEnv(envContent);
  secretsSpinner.stop("[Step 2/6] Secrets generated and saved");

  // ── Step 3: Install dependencies ─────────────────────────────────────
  const installSpinner = p.spinner();
  installSpinner.start("[Step 3/6] Installing dependencies...");
  await installDependencies();
  installSpinner.stop("[Step 3/6] Dependencies installed");

  // ── Step 4: Database migrations ─────────────────────────────────────
  const migrateSpinner = p.spinner();
  migrateSpinner.start("[Step 4/6] Running database migrations...");
  await runMigrations();
  migrateSpinner.stop("[Step 4/6] Database ready");

  // ── Step 5: Build ───────────────────────────────────────────────────
  const buildSpinner = p.spinner();
  buildSpinner.start("[Step 5/6] Building application (this may take ~30s)...");
  await buildApp();
  buildSpinner.stop("[Step 5/6] Build complete");

  // ── Configuration summary ───────────────────────────────────────────
  p.note(
    [
      `Port:       ${port}`,
      `URL:        ${publicUrl}`,
      `Database:   SQLite`,
      `Auth:       Form login`,
      `Home:       ${heysummonDir}`,
    ].join("\n"),
    "Configuration"
  );

  // ── Step 6: Start daemon ─────────────────────────────────────────────
  const startSpinner = p.spinner();
  startSpinner.start("[Step 6/6] Starting HeySummon...");

  try {
    await startDaemon(port);
    startSpinner.stop("[Step 6/6] HeySummon is running!");

    p.log.info(`Dashboard: ${color.cyan(publicUrl)}`);
    p.log.info(`Docs:      ${color.cyan("https://docs.heysummon.ai/getting-started/quickstart")}`);
    p.log.info(`Status:    ${color.cyan("heysummon status")}`);
    p.log.info(`Stop:      ${color.cyan("heysummon stop")}`);

    p.outro(`Open ${color.cyan(publicUrl)} to create your account.`);
  } catch {
    startSpinner.stop("Could not start automatically.");
    p.outro(
      `Run ${color.cyan("heysummon start -d")} to start manually.`
    );
  }
}
