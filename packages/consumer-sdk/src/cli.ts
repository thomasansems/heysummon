#!/usr/bin/env node
/**
 * HeySummon Consumer SDK CLI
 *
 * Shared CLI entry point used by both Claude Code and OpenClaw skill scripts.
 * Subcommands: submit, submit-and-poll, add-provider, list-providers,
 *              check-status, watch, keygen
 *
 * All config comes from environment variables (set by the calling bash wrapper):
 *   HEYSUMMON_BASE_URL, HEYSUMMON_API_KEY, HEYSUMMON_PROVIDERS_FILE,
 *   HEYSUMMON_KEY_DIR, HEYSUMMON_REQUESTS_DIR, HEYSUMMON_TIMEOUT,
 *   HEYSUMMON_POLL_INTERVAL
 */

import { HeySummonClient } from "./client.js";
import { ProviderStore } from "./provider-store.js";
import { RequestTracker } from "./request-tracker.js";
import {
  generateEphemeralKeys,
  generatePersistentKeys,
  loadPublicKeys,
} from "./crypto.js";
import type { PendingEvent, Message } from "./types.js";
import { execSync } from "node:child_process";
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

async function cmdSubmit(args: string[]): Promise<void> {
  const question = getArg(args, "--question");
  if (!question) {
    process.stderr.write("Usage: cli submit --question <q> [--provider <name>] [--context <json>]\n");
    process.exit(1);
  }

  const providerArg = getArg(args, "--provider");
  const contextArg = getArg(args, "--context");
  const baseUrl = requireEnv("HEYSUMMON_BASE_URL");
  const providersFile = optEnv("HEYSUMMON_PROVIDERS_FILE", "");
  const keyDir = optEnv("HEYSUMMON_KEY_DIR", "");
  const requestsDir = optEnv("HEYSUMMON_REQUESTS_DIR", "");

  // Resolve API key from provider store or env
  let apiKey = process.env.HEYSUMMON_API_KEY || "";
  let resolvedProvider = "";

  if (providersFile && existsSync(providersFile)) {
    const store = new ProviderStore(providersFile);

    if (providerArg) {
      const match = store.findByName(providerArg);
      if (match) {
        apiKey = match.apiKey;
        resolvedProvider = match.name;
      } else {
        process.stderr.write(`Provider '${providerArg}' not found.\n`);
        const all = store.load();
        if (all.length) {
          process.stderr.write("Available:\n");
          for (const p of all) {
            process.stderr.write(`  - ${p.name} (${p.providerName})\n`);
          }
        }
        process.exit(1);
      }
    } else if (!apiKey) {
      const def = store.getDefault();
      if (def) {
        apiKey = def.apiKey;
        resolvedProvider = def.name;
      }
    }
  }

  if (!apiKey) {
    process.stderr.write("No API key. Set HEYSUMMON_API_KEY or register a provider.\n");
    process.exit(1);
  }

  // Generate or load keys
  let signPublicKey: string;
  let encryptPublicKey: string;

  if (keyDir && existsSync(`${keyDir}/sign_public.pem`)) {
    const keys = loadPublicKeys(keyDir);
    signPublicKey = keys.signPublicKey;
    encryptPublicKey = keys.encryptPublicKey;
  } else if (keyDir) {
    process.stderr.write(`Generating keypairs in ${keyDir}...\n`);
    const keys = generatePersistentKeys(keyDir);
    signPublicKey = keys.signPublicKey;
    encryptPublicKey = keys.encryptPublicKey;
  } else {
    const keys = generateEphemeralKeys();
    signPublicKey = keys.signPublicKey;
    encryptPublicKey = keys.encryptPublicKey;
  }

  // Parse context messages
  let messages: Array<{ role: string; content: string }> = [];
  if (contextArg) {
    try {
      messages = JSON.parse(contextArg);
    } catch {
      // ignore parse errors
    }
  }

  const client = new HeySummonClient({ baseUrl, apiKey });

  if (resolvedProvider) {
    process.stderr.write(`Provider: ${resolvedProvider}\n`);
  }

  const result = await client.submitRequest({
    question,
    messages: messages.length > 0 ? messages : undefined,
    signPublicKey,
    encryptPublicKey,
    providerName: providerArg || undefined,
  });

  if (!result.requestId) {
    process.stderr.write(`Request failed: ${JSON.stringify(result)}\n`);
    process.exit(1);
  }

  // Track request
  if (requestsDir) {
    const tracker = new RequestTracker(requestsDir);
    tracker.track(result.requestId, result.refCode, resolvedProvider || undefined);
  }

  // Sync provider name
  if (providersFile && existsSync(providersFile) && apiKey) {
    try {
      const whoami = await client.whoami();
      const pName = whoami.provider?.name || "";
      if (pName) {
        const store = new ProviderStore(providersFile);
        const entry = store.findByKey(apiKey);
        if (entry && entry.providerName !== pName) {
          store.add({ ...entry, providerName: pName });
          process.stderr.write(`Provider name updated: ${pName}\n`);
        }
      }
    } catch {
      // non-fatal
    }
  }

  // Output result as JSON
  process.stdout.write(JSON.stringify(result) + "\n");
}

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
  let resolvedProvider = "";

  if (providersFile && existsSync(providersFile)) {
    const store = new ProviderStore(providersFile);
    if (providerArg) {
      const match = store.findByName(providerArg);
      if (match) {
        apiKey = match.apiKey;
        resolvedProvider = match.name;
      } else {
        process.stderr.write(`Provider '${providerArg}' not found.\n`);
        process.exit(1);
      }
    } else if (!apiKey) {
      const def = store.getDefault();
      if (def) {
        apiKey = def.apiKey;
        resolvedProvider = def.name;
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

  const result = await client.submitRequest({
    question,
    messages: messages.length > 0 ? messages : undefined,
    signPublicKey: keys.signPublicKey,
    encryptPublicKey: keys.encryptPublicKey,
    providerName: providerArg || undefined,
  });

  if (result.providerUnavailable) {
    const next = result.nextAvailableAt
      ? ` (available at ${new Date(result.nextAvailableAt).toLocaleTimeString()})`
      : "";
    process.stderr.write(
      `Provider currently unavailable${next} — request queued, waiting for response...\n`
    );
  }

  if (!result.requestId) {
    process.stderr.write(`Failed to submit request: ${JSON.stringify(result)}\n`);
    process.exit(1);
  }

  const ref = result.refCode || result.requestId;
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

  process.stderr.write(`\nTimeout after ${timeout}s — no response received.\n`);
  process.stderr.write(`   Request ref: ${ref}\n`);
  process.stdout.write(
    `TIMEOUT: No response received after ${timeout}s for request ${ref}. The provider may still respond later.\n`
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

async function cmdWatch(args: string[]): Promise<void> {
  const notifyScript = getArg(args, "--notify-script");
  const baseUrl = requireEnv("HEYSUMMON_BASE_URL");
  const providersFile = requireEnv("HEYSUMMON_PROVIDERS_FILE");
  const requestsDir = optEnv("HEYSUMMON_REQUESTS_DIR", "");
  const pollInterval = parseInt(optEnv("HEYSUMMON_POLL_INTERVAL", "5"), 10);

  const store = new ProviderStore(providersFile);
  const tracker = requestsDir ? new RequestTracker(requestsDir) : null;

  // In-memory dedup set
  const seen = new Set<string>();

  process.stderr.write(`Platform watcher started (pid ${process.pid})\n`);
  process.stderr.write(`   Polling every ${pollInterval}s\n`);

  // Write PID file for signaling
  if (requestsDir) {
    const { writeFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    writeFileSync(join(requestsDir, ".watcher.pid"), String(process.pid));
  }

  while (true) {
    const providers = store.load();
    if (providers.length === 0) {
      process.stderr.write("No providers registered.\n");
      await sleep(pollInterval * 1000);
      continue;
    }

    for (const provider of providers) {
      try {
        const client = new HeySummonClient({
          baseUrl,
          apiKey: provider.apiKey,
        });
        const { events } = await client.getPendingEvents();

        for (const event of events) {
          const from = event.from || "unknown";
          const dedupKey = `${event.type}:${from}:${event.requestId}`;

          // Stale check (>30 min)
          if (event.createdAt) {
            const age =
              (Date.now() - new Date(event.createdAt).getTime()) / 1000 / 60;
            if (age > 30) {
              seen.add(dedupKey);
              continue;
            }
          }

          if (seen.has(dedupKey)) continue;
          seen.add(dedupKey);

          // Fetch response text for provider messages
          let responseText = "";
          if (
            event.type === "new_message" &&
            event.from === "provider" &&
            event.requestId
          ) {
            try {
              const { messages } = await client.getMessages(event.requestId);
              const last = messages
                .filter((m: Message) => m.from === "provider")
                .pop();
              if (last?.plaintext) {
                responseText = last.plaintext;
              } else if (last?.ciphertext) {
                responseText = "(encrypted)";
              }
            } catch {
              // non-fatal
            }
          }

          // Build notification
          const fileRef = tracker?.getRefCode(event.requestId) || "";
          const ref = event.refCode || fileRef || event.requestId || "?";

          let msg = "";
          switch (event.type) {
            case "keys_exchanged":
              msg = `Key exchange completed for ${ref} — provider connected`;
              break;
            case "new_message":
              if (event.from === "provider") {
                msg = `New response from provider for ${ref}`;
                if (responseText) msg += `\n${responseText}`;
              }
              break;
            case "responded":
              msg = `Provider responded to ${ref}`;
              break;
            case "closed":
              msg = `Conversation ${ref} closed`;
              if (tracker) tracker.remove(event.requestId);
              break;
            default:
              msg = `HeySummon event (${event.type}) for ${ref}`;
          }

          if (!msg) continue;

          // Build wake text with original question context
          let wakeText = msg;
          if (responseText && event.requestId) {
            try {
              const reqData = await client.getRequestByRef(fileRef || event.requestId);
              const origQuestion = reqData.question || "";
              const provName =
                reqData.provider?.name || reqData.providerName || "the provider";

              wakeText = `${ref} — ${provName} responded!`;
              if (origQuestion)
                wakeText += `\n\nYour question was: ${origQuestion}`;
              wakeText += `\n\nAnswer: ${responseText}`;
              wakeText += `\n\nProceed based on this answer.`;
            } catch {
              // non-fatal, use plain msg
            }
          }

          // Deliver notification
          if (notifyScript) {
            try {
              const eventJson = JSON.stringify({
                event,
                msg,
                wakeText,
                responseText,
                ref,
              });
              execSync(`bash "${notifyScript}"`, {
                input: eventJson,
                stdio: ["pipe", "inherit", "inherit"],
                timeout: 30_000,
              });
            } catch {
              process.stderr.write(`Notify script failed for ${ref}\n`);
            }
          } else {
            process.stdout.write(`${msg}\n`);
          }

          // ACK the event
          await client.ackEvent(event.requestId).catch(() => {});
        }
      } catch (err) {
        process.stderr.write(
          `Poll error for ${provider.name}: ${err instanceof Error ? err.message : String(err)}\n`
        );
      }
    }

    await sleep(pollInterval * 1000);
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
  submit: cmdSubmit,
  "submit-and-poll": cmdSubmitAndPoll,
  "add-provider": cmdAddProvider,
  "list-providers": cmdListProviders,
  "check-status": cmdCheckStatus,
  watch: cmdWatch,
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
