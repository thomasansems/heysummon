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
import { ask, askYesNo, askSecret } from "../lib/prompts";
import { startForeground } from "./start";

export async function init(): Promise<void> {
  console.log("");
  console.log("  \\u{1F99E}  HeySummon Installer");
  console.log("  ========================");
  console.log("  Human-in-the-loop for AI agents");
  console.log("");

  if (isInitialized()) {
    const reinit = await askYesNo(
      "HeySummon is already installed. Reinitialize?",
      false
    );
    if (!reinit) {
      console.log("\n  Cancelled. Use 'heysummon start' to run the server.");
      return;
    }
    // Clean existing app directory
    const appDir = getAppDir();
    if (fs.existsSync(appDir)) {
      fs.rmSync(appDir, { recursive: true });
    }
  }

  // Create directory structure
  const hsDir = getHeysummonDir();
  ensureDir(hsDir);
  ensureDir(getAppDir());

  // Download latest release
  console.log("\n  Step 1/6: Download");
  const version = await downloadAndExtract();
  console.log(`  Downloaded ${version}`);

  // Generate secrets
  console.log("\n  Step 2/6: Generate secrets");
  const secrets = generateSecrets();
  console.log("  Secrets generated");

  // Interactive configuration
  console.log("\n  Step 3/6: Configuration\n");

  const port = parseInt(await ask("Port", "3000"), 10) || 3000;
  const publicUrl = await ask("Public URL", `http://localhost:${port}`);
  const enableFormLogin = await askYesNo("Enable form login?", true);

  const enableGithubOauth = await askYesNo("Enable GitHub OAuth?", false);
  let githubId: string | undefined;
  let githubSecret: string | undefined;
  if (enableGithubOauth) {
    githubId = await askSecret("GitHub Client ID");
    githubSecret = await askSecret("GitHub Client Secret");
  }

  const enableGoogleOauth = await askYesNo("Enable Google OAuth?", false);
  let googleId: string | undefined;
  let googleSecret: string | undefined;
  if (enableGoogleOauth) {
    googleId = await askSecret("Google Client ID");
    googleSecret = await askSecret("Google Client Secret");
  }

  const config: HeysummonConfig = {
    port,
    publicUrl,
    enableFormLogin,
    enableGithubOauth,
    githubId,
    githubSecret,
    enableGoogleOauth,
    googleId,
    googleSecret,
  };

  // Write .env
  const envContent = generateEnv(config, secrets);
  writeEnv(envContent);
  console.log("\n  Configuration saved");

  // Install dependencies
  console.log("\n  Step 4/6: Install dependencies");
  installDependencies();

  // Run migrations
  console.log("\n  Step 5/6: Database setup");
  runMigrations();

  // Build
  console.log("\n  Step 6/6: Build");
  buildApp();

  // Start the server
  console.log("\n  ========================");
  console.log(`  HeySummon is ready!`);
  console.log(`  Starting server on ${publicUrl}...`);
  console.log("");

  startForeground(port);
}
