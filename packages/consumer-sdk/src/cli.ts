#!/usr/bin/env node
/**
 * HeySummon Consumer SDK CLI
 *
 * Shared CLI entry point used by both Claude Code and OpenClaw skill scripts.
 * Subcommands: submit-and-poll, add-provider, list-providers,
 *              check-status, keygen
 *
 * All config comes from environment variables (set by the calling bash wrapper):
 *   HEYSUMMON_BASE_URL, HEYSUMMON_API_KEY, HEYSUMMON_PROVIDERS_FILE,
 *   HEYSUMMON_TIMEOUT,
 *   HEYSUMMON_POLL_INTERVAL
 */

import { HeySummonClient, HeySummonHttpError } from "./client.js";
import { ProviderStore } from "./provider-store.js";
import { generateEphemeralKeys, generatePersistentKeys } from "./crypto.js";
import type { Message } from "./types.js";
import { existsSync } from "node:fs";

// ---------------------------------------------------------------------------
// Arg parsing helpers
// ---------------------------------------------------------------------------

function getArg(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return undefined;
  return args[idx + 1];
}

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) {
    process.stderr.write(`Missing required env var: ${name}\n`);
    process.exit(1);
  }
  return val;
}

function optEnv(name: string, fallback: string): string {
  return process.env[name] || fallback;
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

async function cmdSubmitAndPoll(args: string[]): Promise<void> {
  const question = getArg(args, "--question");
  if (!question) {
    process.stderr.write("Usage: cli submit-and-poll --question <q> [--provider <name>] [--context <json>]\n");
    process.exit(1);
  }

  const providerArg = getArg(args, "--provider");
  const contextArg = getArg(args, "--context");
  const baseUrl = requireEnv("HEYSUMMON_BASE_URL");
  const timeout = parseInt(optEnv("HEYSUMMON_TIMEOUT", "900"), 10);
  const pollInterval = parseInt(optEnv("HEYSUMMON_POLL_INTERVAL", "3"), 10);
  const providersFile = optEnv("HEYSUMMON_PROVIDERS_FILE", "");

  // Resolve API key
  let apiKey = process.env.HEYSUMMON_API_KEY || "";

  if (providersFile && existsSync(providersFile)) {
    const store = new ProviderStore(providersFile);
    if (providerArg) {
      const match = store.findByName(providerArg);
      if (match) {
        apiKey = match.apiKey;
      } else {
        process.stderr.write(`Provider '${providerArg}' not found.\n`);
        process.exit(1);
      }
    } else if (!apiKey) {
      const def = store.getDefault();
      if (def) {
        apiKey = def.apiKey;
      }
    }
  }

  if (!apiKey) {
    process.stderr.write("No API key. Set HEYSUMMON_API_KEY or register a provider.\n");
    process.exit(1);
  }

  // Generate ephemeral keys (Claude Code style — no persistence needed)
  const keys = generateEphemeralKeys();
  const client = new HeySummonClient({ baseUrl, apiKey });

  process.stderr.write("HeySummon: Submitting request to human...\n");

  // Parse context
  let messages: Array<{ role: string; content: string }> = [];
  if (contextArg) {
    try {
      messages = JSON.parse(contextArg);
    } catch {
      // ignore
    }
  }

  let result;
  try {
    result = await client.submitRequest({
      question,
      messages: messages.length > 0 ? messages : undefined,
      signPublicKey: keys.signPublicKey,
      encryptPublicKey: keys.encryptPublicKey,
      providerName: providerArg || undefined,
    });
  } catch (err) {
    if (err instanceof HeySummonHttpError && err.status === 403) {
      let parsed: { error?: string; hint?: string; ip?: string } = {};
      try { parsed = JSON.parse(err.body); } catch { /* ignore */ }

      const ip = parsed.ip || "unknown";
      const hint = parsed.hint || "";
      process.stderr.write(
        `IP address ${ip} is not authorized for this API key.\n` +
        `${hint ? hint + "\n" : ""}` +
        `Your provider needs to allow this IP address in the HeySummon dashboard under Clients > IP Security.\n` +
        `Once allowed, re-run this command.\n`
      );
      process.stdout.write(`IP_NOT_ALLOWED: IP address ${ip} is not authorized. Ask your provider to allow it in their HeySummon dashboard.\n`);
      return;
    }
    throw err;
  }

  if (!result.requestId) {
    process.stderr.write(`Failed to submit request: ${JSON.stringify(result)}\n`);
    process.exit(1);
  }

  const ref = result.refCode || result.requestId;

  // When provider is unavailable, the platform rejects the request
  if (result.rejected) {
    const msg = result.message || "Provider is not available right now.";
    process.stderr.write(`${msg}\n`);
    process.stdout.write(
      `PROVIDER_UNAVAILABLE: ${msg}${result.nextAvailableAt ? ` Next available: ${result.nextAvailableAt}` : ""}\n`
    );
    return;
  }

  process.stderr.write(
    `Request submitted [${ref}] — waiting for human response...\n`
  );
  process.stderr.write(
    `   (timeout: ${timeout}s, polling every ${pollInterval}s)\n`
  );

  // Polling loop
  let elapsed = 0;
  while (elapsed < timeout) {
    await sleep(pollInterval * 1000);
    elapsed += pollInterval;

    try {
      // Check status endpoint
      const status = await client.getRequestStatus(result.requestId);
      if (
        (status.status === "responded" || status.status === "closed") &&
        status.response
      ) {
        process.stderr.write(`\nHuman responded [${ref}]\n`);
        process.stdout.write(status.response + "\n");
        return;
      }

      // Fallback: check messages for plaintext replies
      const { messages: msgs } = await client.getMessages(result.requestId);
      const providerMsg = msgs.filter((m: Message) => m.from === "provider").pop();
      if (providerMsg) {
        if (providerMsg.plaintext) {
          process.stderr.write(`\nHuman responded [${ref}]\n`);
          process.stdout.write(providerMsg.plaintext + "\n");
          await client.ackEvent(result.requestId).catch(() => {});
          return;
        }
        if (providerMsg.ciphertext) {
          process.stderr.write(`\nHuman responded [${ref}]\n`);
          process.stdout.write("(encrypted response received)\n");
          await client.ackEvent(result.requestId).catch(() => {});
          return;
        }
      }
    } catch {
      // polling error, continue
    }

    // Progress indicator
    if (elapsed % 30 === 0) {
      process.stderr.write(`   Still waiting... (${elapsed}s elapsed)\n`);
    }
  }

  // Report timeout to server (notifies provider, records timestamp)
  await client.reportTimeout(result.requestId).catch(() => {});

  process.stderr.write(`\nTimeout after ${timeout}s — no response received.\n`);
  process.stderr.write(`   Request ref: ${ref}\n`);
  process.stdout.write(
    `TIMEOUT: No answer came back from the provider within the ${timeout}s timeout window. Request ref: ${ref}\n`
  );
}

async function cmdAddProvider(args: string[]): Promise<void> {
  const key = getArg(args, "--key");
  const alias = getArg(args, "--alias");

  if (!key) {
    process.stderr.write("Usage: cli add-provider --key <api-key> [--alias <name>]\n");
    process.exit(1);
  }

  // Validate key prefix
  if (key.startsWith("hs_prov_") || key.startsWith("htl_prov_")) {
    process.stderr.write("This is a provider key. Use a CLIENT key (hs_cli_... or htl_...).\n");
    process.exit(1);
  }
  if (!key.startsWith("hs_cli_") && !key.startsWith("htl_")) {
    process.stderr.write("Invalid key format. Must start with 'hs_cli_' or 'htl_'.\n");
    process.exit(1);
  }

  const baseUrl = requireEnv("HEYSUMMON_BASE_URL");
  const providersFile = requireEnv("HEYSUMMON_PROVIDERS_FILE");

  const client = new HeySummonClient({ baseUrl, apiKey: key });
  const whoami = await client.whoami();

  const providerName = whoami.provider?.name || "";
  const providerId = whoami.provider?.id || "";

  if (!providerName) {
    process.stderr.write("Could not fetch provider info. Is the key valid?\n");
    process.exit(1);
  }

  const name = alias || providerName;
  const store = new ProviderStore(providersFile);
  store.add({
    name,
    apiKey: key,
    providerId,
    providerName,
  });

  const count = store.load().length;
  process.stdout.write(`Provider added: ${name} (${providerName})\n`);
  process.stdout.write(`Providers registered: ${count}\n`);
}

async function cmdListProviders(): Promise<void> {
  const providersFile = optEnv("HEYSUMMON_PROVIDERS_FILE", "");

  if (!providersFile || !existsSync(providersFile)) {
    process.stdout.write("No providers registered yet.\n");
    return;
  }

  const store = new ProviderStore(providersFile);
  const providers = store.load();

  if (providers.length === 0) {
    process.stdout.write("No providers registered yet.\n");
    return;
  }

  process.stdout.write(`Registered providers (${providers.length}):\n`);
  for (let i = 0; i < providers.length; i++) {
    const p = providers[i];
    const nameExtra =
      p.providerName !== p.name ? ` (provider: ${p.providerName})` : "";
    process.stdout.write(
      `  ${i + 1}. ${p.name}${nameExtra} — key: ${p.apiKey.slice(0, 12)}...\n`
    );
  }
}

async function cmdCheckStatus(args: string[]): Promise<void> {
  const ref = getArg(args, "--ref") || args[args.indexOf("check-status") + 1];

  if (!ref) {
    process.stderr.write("Usage: cli check-status --ref <refCode|requestId>\n");
    process.exit(1);
  }

  const baseUrl = requireEnv("HEYSUMMON_BASE_URL");
  const apiKey = requireEnv("HEYSUMMON_API_KEY");
  const client = new HeySummonClient({ baseUrl, apiKey });

  try {
    const data = await client.getRequestStatus(ref);
    const icons: Record<string, string> = {
      pending: "⏳",
      responded: "✅",
      resolved: "✅",
      expired: "⏰",
      cancelled: "❌",
    };
    const status = data.status || "unknown";
    process.stdout.write(`${icons[status] || "•"} Status: ${status}\n`);
    if (data.refCode) process.stdout.write(`  Ref: ${data.refCode}\n`);
    if (data.response || data.lastMessage) {
      process.stdout.write(`  Response: ${data.response || data.lastMessage}\n`);
    }
  } catch (err) {
    process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  }
}

async function cmdKeygen(args: string[]): Promise<void> {
  const dir = getArg(args, "--dir") || optEnv("HEYSUMMON_KEY_DIR", "");

  if (!dir) {
    process.stderr.write("Usage: cli keygen --dir <path>\n");
    process.exit(1);
  }

  const keys = generatePersistentKeys(dir);
  process.stderr.write(`Keypairs generated in ${dir}\n`);
  process.stdout.write(JSON.stringify(keys) + "\n");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const [command, ...rest] = process.argv.slice(2);

const commands: Record<string, (args: string[]) => Promise<void>> = {
  "submit-and-poll": cmdSubmitAndPoll,
  "add-provider": cmdAddProvider,
  "list-providers": cmdListProviders,
  "check-status": cmdCheckStatus,
  keygen: cmdKeygen,
};

if (!command || !commands[command]) {
  process.stderr.write(
    `Usage: cli <command> [args]\n\nCommands:\n  ${Object.keys(commands).join("\n  ")}\n`
  );
  process.exit(1);
}

commands[command](rest).catch((err) => {
  process.stderr.write(
    `Error: ${err instanceof Error ? err.message : String(err)}\n`
  );
  process.exit(1);
});
