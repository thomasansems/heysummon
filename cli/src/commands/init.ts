import * as fs from "fs";
import * as path from "path";
import { execFileSync } from "child_process";
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
import { installDependencies, runMigrations, buildApp, waitForHealthy } from "../lib/database";
import { askYesNo } from "../lib/prompts";
import { startDaemon } from "./start";
import { printAnimatedBanner, color } from "../lib/ui";
import { checkSystem, formatSystemSummary } from "../lib/system-check";

function copyFromSourceDir(sourceDir: string, destDir: string): void {
  const absSource = path.resolve(sourceDir);
  if (!fs.existsSync(absSource)) {
    throw new Error(`Source directory not found: ${absSource}`);
  }
  if (!fs.existsSync(path.join(absSource, "package.json"))) {
    throw new Error(`No package.json in source directory: ${absSource}`);
  }
  execFileSync(
    "rsync",
    [
      "-a",
      "--exclude=node_modules",
      "--exclude=.next",
      "--exclude=.git",
      `${absSource}/`,
      `${destDir}/`,
    ],
    { stdio: "pipe" }
  );
}

export async function init(opts?: { yes?: boolean; fromSource?: string }): Promise<void> {
  const quickstart = opts?.yes ?? false;
  const fromSource = opts?.fromSource;

  await printAnimatedBanner();

  p.intro("heysummon init");

  const heysummonDir = getHeysummonDir();

  p.log.info(`Home: ${color.cyan(heysummonDir)}`);

  // ── System check ──────────────────────────────────────────────────
  const sysCheck = checkSystem(heysummonDir);
  p.note(formatSystemSummary(sysCheck), "System");

  if (sysCheck.warnings.length > 0) {
    for (const warning of sysCheck.warnings) {
      p.log.warn(warning);
    }
  }

  if (!sysCheck.canInstall) {
    p.log.error("Your system does not meet the minimum requirements.");
    if (!quickstart) {
      const forceContinue = await askYesNo(
        "Continue anyway? (installation may fail)",
        false
      );
      if (!forceContinue) {
        p.outro("Resolve the issues above and try again.");
        process.exit(1);
      }
    } else {
      p.outro("Resolve the issues above and try again.");
      process.exit(1);
    }
  }

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

  // ── Source ──────────────────────────────────────────────────────────
  const dlSpinner = p.spinner();
  if (fromSource) {
    dlSpinner.start(`Copying from local source: ${fromSource}...`);
    copyFromSourceDir(fromSource, getAppDir());
    dlSpinner.stop("Copied from local source");
  } else {
    dlSpinner.start("Downloading latest release from GitHub...");
    const version = await downloadAndExtract();
    dlSpinner.stop(`Downloaded HeySummon ${version}`);
  }

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

    const defaultPublicUrl = `http://localhost:${port}`;

    const urlInput = await p.text({
      message: "Public URL (e.g. https://YOUR_DOMAIN, or keep default for local)",
      defaultValue: defaultPublicUrl,
      placeholder: defaultPublicUrl,
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

  // ── Dependencies ────────────────────────────────────────────────────
  const depSpinner = p.spinner();
  depSpinner.start("Installing dependencies...");
  await installDependencies((elapsed) => {
    depSpinner.message(`Installing dependencies... ${elapsed}s elapsed`);
  });
  depSpinner.stop("Dependencies installed");

  // ── Database ────────────────────────────────────────────────────────
  const dbSpinner = p.spinner();
  dbSpinner.start("Running database migrations...");
  await runMigrations((elapsed) => {
    dbSpinner.message(`Running database migrations... ${elapsed}s elapsed`);
  });
  dbSpinner.stop("Database ready");

  // ── Build ───────────────────────────────────────────────────────────
  const { min, max } = sysCheck.estimatedMinutes;
  p.log.info(
    `Building the app — estimated ${color.cyan(`${min}–${max} minutes`)} for your machine.`
  );
  const buildSpinner = p.spinner();
  buildSpinner.start("Building application... 0s elapsed");
  await buildApp((elapsed) => {
    buildSpinner.message(`Building application... ${elapsed}s elapsed`);
  });
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
    startSpinner.message("Waiting for server to become healthy...");

    const healthy = await waitForHealthy(port, 30);

    if (healthy) {
      startSpinner.stop("HeySummon is running!");
    } else {
      startSpinner.stop("Server started but not yet responding. It may need more time to initialize.");
      p.log.warn(`Check status with: ${color.cyan("heysummon status")}`);
    }

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
