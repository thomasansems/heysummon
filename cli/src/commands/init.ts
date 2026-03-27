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

  // ── Download ────────────────────────────────────────────────────────
  const dlSpinner = p.spinner();
  dlSpinner.start("Downloading latest release from GitHub...");
  const version = await downloadAndExtract();
  dlSpinner.stop(`Downloaded HeySummon ${version}`);

  // ── Configuration ───────────────────────────────────────────────────
  let port = 3435;
  let publicUrl = `http://localhost:${port}`;

  if (!quickstart) {
    const portInput = await p.text({
      message: "Guard port (app entry point)",
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

  // ── Secrets ─────────────────────────────────────────────────────────
  const secretsSpinner = p.spinner();
  secretsSpinner.start("Generating secure random secrets...");
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
  secretsSpinner.stop("Secrets generated and saved");

  // ── Database ────────────────────────────────────────────────────────
  const dbSpinner = p.spinner();
  dbSpinner.start("Setting up SQLite database and running migrations...");
  installDependencies();
  runMigrations();
  dbSpinner.stop("Database ready");

  // ── Build ───────────────────────────────────────────────────────────
  const buildSpinner = p.spinner();
  buildSpinner.start("Building application (this takes ~30 seconds)...");
  buildApp();
  buildSpinner.stop("Build complete");

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

  // ── Start daemon ────────────────────────────────────────────────────
  const startSpinner = p.spinner();
  startSpinner.start("Starting HeySummon in the background...");

  try {
    await startDaemon(port);
    startSpinner.stop("HeySummon is running!");

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
